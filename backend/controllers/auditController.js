import * as auditService from "../services/auditService.js";

export const listAuditLogs = async (req, res) => {
  try {
    const { page, limit, action, targetType, category } = req.query;
    const result = await auditService.listAuditLogs({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      action,
      targetType,
      category,
    });
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};
