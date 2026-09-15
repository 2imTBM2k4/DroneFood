import AuditLog from "../models/auditLogModel.cjs";

/** Newest first, paginated, optionally narrowed to one action or target type. */
export const listAuditLogs = async ({
  page = 1,
  limit = 50,
  action,
  targetType,
  category,
} = {}) => {
  const filter = {};
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
  if (category) filter.category = category;

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
