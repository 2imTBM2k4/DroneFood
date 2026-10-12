import AuditLog from "../models/auditLogModel.cjs";
import AppError from "../utils/AppError.js";

/** Newest first, paginated, optionally narrowed to one action or target type. */
export const listAuditLogs = async ({
  user,
  page = 1,
  limit = 50,
  action,
  targetType,
  category,
  merchantId,
  branchId,
} = {}) => {
  const filter = {};
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
  if (category) filter.category = category;

  if (user) {
    if (user.role === "admin") {
      if (merchantId) filter.merchantId = merchantId;
      if (branchId) filter.branchId = branchId;
    } else if (user.role === "merchant_owner") {
      const { Merchant, Branch } = await import("../models/index.cjs");
      const merchant = await Merchant.findOne({ ownerUserId: user._id });
      if (!merchant) {
        return {
          success: true,
          data: [],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
        };
      }
      if (merchantId && merchantId.toString() !== merchant._id.toString()) {
        throw new AppError("Bạn không có quyền xem audit log của merchant khác", 403);
      }
      filter.merchantId = merchant._id;
      if (branchId) {
        const belongs = await Branch.exists({ _id: branchId, merchantId: merchant._id });
        if (!belongs) {
          throw new AppError("Chi nhánh không thuộc quyền quản lý của bạn", 403);
        }
        filter.branchId = branchId;
      }
    } else if (user.role === "branch_manager") {
      if (merchantId) {
        throw new AppError("Quản lý chi nhánh không được phép truy vấn toàn bộ merchant", 403);
      }
      const { Branch } = await import("../models/index.cjs");
      const branches = await Branch.find({ managerUserIds: user._id }).select("_id");
      const branchIds = branches.map((b) => b._id.toString());
      if (branchIds.length === 0) {
        return {
          success: true,
          data: [],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
        };
      }
      if (branchId) {
        if (!branchIds.includes(branchId.toString())) {
          throw new AppError("Bạn không có quyền xem audit log của chi nhánh này", 403);
        }
        filter.branchId = branchId;
      } else {
        filter.branchId = { $in: branches.map((b) => b._id) };
      }
    } else {
      throw new AppError("Unauthorized", 403);
    }
  }

  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const skip = (Math.max(page, 1) - 1) * safeLimit;

  const [data, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actor", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    success: true,
    data,
    pagination: {
      page,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};
