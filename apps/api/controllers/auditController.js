import * as auditService from "../services/auditService.js";

export const listAuditLogs = async (req, res) => {
  try {
    const { page, limit, action, targetType, category, merchantId, branchId } =
      req.query;
    const result = await auditService.listAuditLogs({
      user: req.user,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      action,
      targetType,
      category,
      merchantId,
      branchId,
    });
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};
