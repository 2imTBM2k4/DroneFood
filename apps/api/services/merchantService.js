import mongoose from "mongoose";
import AppError from "../utils/AppError.js";
import { recordAudit } from "../utils/auditLog.js";
import * as merchantRepo from "../repositories/merchantRepository.js";
import * as branchRepo from "../repositories/branchRepository.js";
import * as branchService from "./branchService.js";
import { User, Branch, Merchant } from "../models/index.cjs";

const supportsTransactions = () => {
  const topologyType = mongoose.connection?.client?.topology?.description?.type;
  if (topologyType === "ReplicaSetWithPrimary" || topologyType === "Sharded") {
    return true;
  }
  const uri = process.env.MONGODB_URI || "";
  return uri.includes("replicaSet=") || uri.startsWith("mongodb+srv://");
};

export const slugify = (value = "") => {
  const slug = String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "merchant";
};

export const generateUniqueSlug = async (name, session = null) => {
  const base = slugify(name);
  let candidate = base;
  let counter = 1;

  while (true) {
    let query = Merchant.findOne({ slug: candidate });
    if (session) query = query.session(session);
    const existing = await query;
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${counter}`;
    counter += 1;
  }
};

/**
 * Đăng ký merchant mới và tạo chi nhánh chính mặc định (MAIN).
 */
export const registerMerchant = async ({
  userId,
  name,
  address,
  phone,
  images = [],
}) => {
  if (!userId) {
    throw new AppError("userId là bắt buộc", 400);
  }

  if (!name || !name.trim()) {
    throw new AppError("Tên thương hiệu (name) là bắt buộc", 400);
  }

  const existingMerchant = await merchantRepo.findByOwnerUserId(userId);
  if (existingMerchant && existingMerchant.status !== "suspended") {
    throw new AppError("Bạn đã sở hữu một merchant", 409);
  }

  const addressText =
    typeof address === "string" ? address : address?.text || address?.address || "";
  const lat = address?.lat;
  const lng = address?.lng;
  const hasCoordinates =
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 &&
    Math.abs(Number(lng)) <= 180;

  const branchAddress = {
    text: addressText,
    lat: hasCoordinates ? Number(lat) : null,
    lng: hasCoordinates ? Number(lng) : null,
  };
  const location = hasCoordinates
    ? { type: "Point", coordinates: [Number(lng), Number(lat)] }
    : undefined;

  const imageList = Array.isArray(images)
    ? images
    : typeof images === "string"
      ? [images]
      : [];

  let createdMerchant;
  let createdBranch;

  const executeRegistration = async (session = null) => {
    const slug = await generateUniqueSlug(name, session);

    const merchant = new Merchant({
      type: "individual",
      name: name.trim(),
      slug,
      ownerUserId: userId,
      status: "pending",
      branchCount: 1,
      logoUrl: imageList[0] || "",
      coverUrl: imageList[1] || imageList[0] || "",
    });
    await merchant.save(session ? { session } : {});

    const branch = new Branch({
      merchantId: merchant._id,
      name: "Chi nhánh chính",
      code: "MAIN",
      address: branchAddress,
      ...(location ? { location } : {}),
      phone: phone || "",
      images: imageList,
      isOpen: false,
      status: "pending",
    });
    await branch.save(session ? { session } : {});

    let userQuery = User.findById(userId);
    if (session) userQuery = userQuery.session(session);
    const user = await userQuery;
    if (user && (user.role === "restaurant_owner" || user.role === "user")) {
      user.role = "merchant_owner";
      await user.save(session ? { session } : {});
    }

    createdMerchant = merchant;
    createdBranch = branch;
  };

  try {
    if (supportsTransactions()) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await executeRegistration(session);
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Fallback for standalone MongoDB: execute sequentially with manual compensation on failure
      try {
        await executeRegistration(null);
      } catch (err) {
        if (createdMerchant?._id) {
          await Branch.deleteMany({ merchantId: createdMerchant._id }).catch(() => {});
          await Merchant.deleteOne({ _id: createdMerchant._id }).catch(() => {});
        }
        throw err;
      }
    }
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.ownerUserId || error.message?.includes("ownerUserId")) {
        throw new AppError("Bạn đã sở hữu một merchant", 409);
      }
      if (error.keyPattern?.slug || error.message?.includes("slug")) {
        throw new AppError("Tên thương hiệu tạo slug bị trùng lặp, vui lòng thử lại", 409);
      }
    }
    throw error;
  }

  await recordAudit({
    actor: { _id: userId, role: "merchant_owner" },
    action: "merchant.register",
    targetType: "merchant",
    targetId: createdMerchant._id,
    merchantId: createdMerchant._id,
    branchId: createdBranch._id,
    reason: "Đăng ký merchant mới",
    metadata: { name: createdMerchant.name, branchCode: createdBranch.code },
  });

  return { merchant: createdMerchant, branch: createdBranch };
};

/**
 * Phê duyệt Merchant (Admin).
 */
export const approveMerchant = async (merchantId, adminUserId) => {
  const merchant = await merchantRepo.findById(merchantId);
  if (!merchant) {
    throw new AppError("Merchant không tồn tại", 404);
  }

  if (merchant.status !== "pending" && merchant.status !== "suspended") {
    throw new AppError("Chỉ có thể duyệt merchant đang ở trạng thái pending hoặc suspended", 400);
  }

  const wasPending = merchant.status === "pending";

  const updatedMerchant = await merchantRepo.updateById(merchantId, {
    status: "active",
    approvedBy: adminUserId,
    approvedAt: new Date(),
    rejectReason: "",
  });

  // Quy tắc kích hoạt chi nhánh:
  // - Nếu duyệt lần đầu từ 'pending': tự động kích hoạt chi nhánh chính 'MAIN' sang 'active'.
  // - Nếu mở lại từ 'suspended': KHÔNG tự động kích hoạt lại chi nhánh nào; giữ nguyên trạng thái chi nhánh trước đó.
  //   Đồng thời, KHÔNG tự động mở cửa (isOpen = true); chủ thương hiệu phải tự mở lại từng chi nhánh.
  if (wasPending) {
    await Branch.updateMany(
      { merchantId, code: "MAIN", status: "pending" },
      { status: "active" }
    );
  }

  await branchService.syncMerchantBranchCount(merchantId);

  await recordAudit({
    actor: { _id: adminUserId, role: "admin" },
    action: "merchant.approve",
    targetType: "merchant",
    targetId: merchantId,
    merchantId,
    reason: wasPending ? "Admin phê duyệt merchant lần đầu" : "Admin mở khóa un-suspend merchant",
  });

  return updatedMerchant;
};

/**
 * Đình chỉ Merchant (Admin).
 */
export const suspendMerchant = async (merchantId, adminUserId, reason = "") => {
  const merchant = await merchantRepo.findById(merchantId);
  if (!merchant) {
    throw new AppError("Merchant không tồn tại", 404);
  }

  const updatedMerchant = await merchantRepo.updateById(merchantId, {
    status: "suspended",
    rejectReason: reason,
  });

  // Khi đình chỉ: đóng tất cả branch (isOpen = false).
  // Lưu ý: khi un-suspend (approve lại), hệ thống KHÔNG tự động mở lại isOpen = true;
  // Chủ thương hiệu (merchant_owner) phải tự mở lại từng chi nhánh.
  await Branch.updateMany({ merchantId }, { isOpen: false });

  await recordAudit({
    actor: { _id: adminUserId, role: "admin" },
    action: "merchant.suspend",
    targetType: "merchant",
    targetId: merchantId,
    merchantId,
    reason: reason || "Admin đình chỉ hoạt động merchant",
    metadata: { reason },
  });

  return updatedMerchant;
};

/**
 * Lấy thông tin công khai của Merchant qua slug.
 */
export const getPublicMerchantBySlug = async (slug) => {
  if (!slug) {
    throw new AppError("Slug là bắt buộc", 400);
  }

  const merchant = await merchantRepo.findBySlug(
    slug.toLowerCase(),
    "-ownerUserId -revenueShare",
    { lean: true }
  );

  if (!merchant || merchant.status !== "active") {
    throw new AppError("Merchant không tồn tại hoặc chưa hoạt động", 404);
  }

  const branches = await branchRepo.findByMerchantId(merchant._id, {
    status: "active",
  });

  return { merchant, branches };
};

/**
 * Lấy thông tin hồ sơ merchant và danh sách chi nhánh phù hợp với role của user đang đăng nhập.
 * - merchant_owner / restaurant_owner: lấy thông tin merchant họ sở hữu và toàn bộ chi nhánh.
 * - branch_manager: lấy thông tin merchant thương hiệu và danh sách các chi nhánh được phân công quản lý.
 * - admin: lấy thông tin merchant nếu sở hữu.
 */
export const getMyMerchantProfile = async (userOrId) => {
  let user = userOrId;
  if (!user || typeof user !== "object" || !user.role) {
    user = await User.findById(userOrId).lean();
  }
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const userId = user._id;

  if (user.role === "branch_manager") {
    const branches = await Branch.find({ managerUserIds: userId });
    if (!branches || branches.length === 0) {
      throw new AppError("Bạn chưa được phân công quản lý chi nhánh nào", 404);
    }
    const merchant = await Merchant.findById(branches[0].merchantId);
    if (!merchant) {
      throw new AppError("Không tìm thấy thông tin merchant", 404);
    }
    return { merchant, branches };
  }

  if (user.role === "restaurant_owner" || user.role === "merchant_owner") {
    const { Restaurant } = await import("../models/index.cjs");
    const restaurant = await Restaurant.findOne({ owner: userId });
    if (restaurant) {
      const { ensureLegacyBranch } = await import("./droneDeliveryApplicationService.js");
      await ensureLegacyBranch(restaurant);
    }
  }

  const merchant = await merchantRepo.findByOwnerUserId(userId);
  if (!merchant) {
    throw new AppError("Bạn chưa có thông tin merchant", 404);
  }

  const branches = await branchRepo.findByMerchantId(merchant._id);
  return { merchant, branches };
};

/**
 * Lấy thông tin merchant của user đang đăng nhập (tương thích ngược).
 */
export const getMerchantByOwner = async (userId) => {
  return getMyMerchantProfile(userId);
};

/**
 * Cập nhật thông tin Merchant.
 */
export const updateMerchant = async (merchantId, updates, actorUser) => {
  const merchant = await merchantRepo.updateById(merchantId, updates);
  if (!merchant) {
    throw new AppError("Merchant không tồn tại", 404);
  }

  await recordAudit({
    actor: actorUser,
    action: "merchant.update",
    targetType: "merchant",
    targetId: merchantId,
    merchantId,
    reason: "Cập nhật thông tin merchant",
    metadata: updates,
  });

  return merchant;
};

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Danh sách merchant (Admin).
 */
export const listMerchants = async ({
  status,
  type,
  q,
  page,
  limit,
  sortBy,
  order,
}) => {
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;

  return await merchantRepo.findAll(filter, {
    page,
    limit,
    q: q ? escapeRegex(q.trim()) : "",
    sortBy,
    order,
  });
};

/**
 * Nộp hồ sơ đăng ký nâng cấp quán cá nhân lên chuỗi thương hiệu nhiều chi nhánh.
 */
export const submitBrandApplication = async ({
  userId,
  merchantId,
  applicationData,
}) => {
  let merchant = null;
  if (merchantId) {
    merchant = await merchantRepo.findById(merchantId);
  } else {
    merchant = await merchantRepo.findByOwnerUserId(userId);
  }

  if (!merchant) {
    const { Restaurant } = await import("../models/index.cjs");
    const restaurant = await Restaurant.findOne({ owner: userId });
    if (restaurant) {
      const { ensureLegacyBranch } = await import(
        "./droneDeliveryApplicationService.js"
      );
      await ensureLegacyBranch(restaurant);
      merchant = await merchantRepo.findByOwnerUserId(userId);
    }
  }

  if (!merchant) {
    throw new AppError("Không tìm thấy thông tin cửa hàng / thương hiệu", 404);
  }

  if (merchant.ownerUserId.toString() !== userId.toString()) {
    throw new AppError("Bạn không có quyền nộp hồ sơ cho thương hiệu này", 403);
  }

  if (merchant.type === "brand") {
    throw new AppError("Cửa hàng của bạn đã là chuỗi thương hiệu", 400);
  }

  if (merchant.brandApplication?.status === "pending") {
    throw new AppError(
      "Hồ sơ nâng cấp thương hiệu đang chờ Admin xét duyệt",
      409
    );
  }

  const licenseImages = Array.isArray(applicationData.licenseImages)
    ? applicationData.licenseImages.filter(Boolean)
    : [];

  merchant.brandApplication = {
    status: "pending",
    brandName: applicationData.brandName.trim(),
    taxCode: applicationData.taxCode ? applicationData.taxCode.trim() : "",
    representativeName: applicationData.representativeName.trim(),
    phone: applicationData.phone.trim(),
    licenseImages,
    notes: applicationData.notes ? applicationData.notes.trim() : "",
    submittedBy: userId,
    submittedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
    rejectReason: "",
  };

  await merchant.save();

  await recordAudit({
    actor: { _id: userId, role: "restaurant_owner" },
    action: "merchant.brand_application_submitted",
    targetType: "merchant",
    targetId: merchant._id,
    merchantId: merchant._id,
    reason: "Nộp hồ sơ nâng cấp chuỗi thương hiệu",
    metadata: {
      brandName: merchant.brandApplication.brandName,
      taxCode: merchant.brandApplication.taxCode,
    },
  });

  return merchant.brandApplication;
};

/**
 * Lấy hồ sơ nâng cấp chuỗi thương hiệu của merchant hiện tại.
 */
export const getBrandApplication = async ({ userId, merchantId }) => {
  let merchant = null;
  if (merchantId) {
    merchant = await merchantRepo.findById(merchantId);
  } else {
    merchant = await merchantRepo.findByOwnerUserId(userId);
  }

  if (!merchant) {
    const { Restaurant } = await import("../models/index.cjs");
    const restaurant = await Restaurant.findOne({ owner: userId });
    if (restaurant) {
      const { ensureLegacyBranch } = await import(
        "./droneDeliveryApplicationService.js"
      );
      await ensureLegacyBranch(restaurant);
      merchant = await merchantRepo.findByOwnerUserId(userId);
    }
  }

  if (!merchant) {
    throw new AppError("Không tìm thấy thông tin cửa hàng / thương hiệu", 404);
  }

  return {
    merchantId: merchant._id,
    type: merchant.type,
    name: merchant.name,
    brandApplication: merchant.brandApplication || {
      status: "not_registered",
    },
  };
};

/**
 * Lấy danh sách hồ sơ nâng cấp thương hiệu (Admin).
 */
export const listBrandApplications = async ({
  status = "pending",
  page = 1,
  limit = 20,
  q,
}) => {
  const filter = {};
  if (status && status !== "all") {
    filter["brandApplication.status"] = status;
  } else {
    filter["brandApplication.status"] = {
      $in: ["pending", "approved", "rejected"],
    };
  }

  if (q && q.trim()) {
    const escaped = escapeRegex(q.trim());
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { "brandApplication.brandName": { $regex: escaped, $options: "i" } },
      { "brandApplication.taxCode": { $regex: escaped, $options: "i" } },
      {
        "brandApplication.representativeName": {
          $regex: escaped,
          $options: "i",
        },
      },
    ];
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [merchants, total] = await Promise.all([
    Merchant.find(filter)
      .populate("ownerUserId", "name email phone")
      .populate("brandApplication.submittedBy", "name email")
      .populate("brandApplication.reviewedBy", "name email")
      .sort({ "brandApplication.submittedAt": -1, updatedAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    Merchant.countDocuments(filter),
  ]);

  return {
    data: merchants,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  };
};

/**
 * Phê duyệt hoặc từ chối hồ sơ nâng cấp chuỗi thương hiệu (Admin).
 */
export const decideBrandApplication = async (
  merchantId,
  { decision, reason },
  adminUser
) => {
  const merchant = await merchantRepo.findById(merchantId);
  if (!merchant) {
    throw new AppError("Merchant không tồn tại", 404);
  }

  if (merchant.brandApplication?.status !== "pending") {
    throw new AppError("Chỉ có thể xử lý hồ sơ đang ở trạng thái pending", 400);
  }

  if (decision === "approved") {
    merchant.brandApplication.status = "approved";
    merchant.brandApplication.reviewedBy = adminUser._id;
    merchant.brandApplication.reviewedAt = new Date();
    merchant.brandApplication.rejectReason = "";
    merchant.type = "brand";

    if (merchant.brandApplication.brandName) {
      merchant.name = merchant.brandApplication.brandName;
    }

    await merchant.save();

    // Nâng cấp role người sở hữu thành merchant_owner
    await User.findByIdAndUpdate(merchant.ownerUserId, {
      role: "merchant_owner",
    });

    await recordAudit({
      actor: { _id: adminUser._id, role: "admin" },
      action: "merchant.brand_application_approved",
      targetType: "merchant",
      targetId: merchant._id,
      merchantId: merchant._id,
      reason: "Admin phê duyệt nâng cấp chuỗi thương hiệu",
      metadata: { brandName: merchant.name },
    });
  } else if (decision === "rejected") {
    merchant.brandApplication.status = "rejected";
    merchant.brandApplication.rejectReason = (reason || "").trim();
    merchant.brandApplication.reviewedBy = adminUser._id;
    merchant.brandApplication.reviewedAt = new Date();

    await merchant.save();

    await recordAudit({
      actor: { _id: adminUser._id, role: "admin" },
      action: "merchant.brand_application_rejected",
      targetType: "merchant",
      targetId: merchant._id,
      merchantId: merchant._id,
      reason: reason || "Admin từ chối hồ sơ nâng cấp chuỗi thương hiệu",
      metadata: { reason },
    });
  }

  return merchant;
};
