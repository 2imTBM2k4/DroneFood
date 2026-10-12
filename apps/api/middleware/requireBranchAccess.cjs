const mongoose = require("mongoose");
const { Branch, Merchant } = require("../models/index.cjs");

let AppError;
try {
  const imported = require("../utils/AppError.js");
  AppError = imported.default || imported;
} catch {
  AppError = class extends Error {
    constructor(message, statusCode = 500) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = true;
    }
  };
}

const resolveBranchId = (req) => {
  return (
    req.params?.branchId ||
    req.params?.id ||
    req.body?.branchId ||
    req.query?.branchId ||
    null
  );
};

const requireBranchAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError("Yêu cầu đăng nhập để thực hiện thao tác này", 401));
    }

    const rawBranchId = resolveBranchId(req);
    if (!rawBranchId) {
      return next(new AppError("branchId là bắt buộc", 400));
    }

    if (!mongoose.Types.ObjectId.isValid(rawBranchId)) {
      return next(new AppError("branchId không hợp lệ", 400));
    }

    const branch = await Branch.findById(rawBranchId);
    if (!branch) {
      return next(new AppError("Chi nhánh không tồn tại", 404));
    }

    const merchant = await Merchant.findById(branch.merchantId);
    if (!merchant) {
      return next(new AppError("Merchant của chi nhánh không tồn tại", 404));
    }

    req.branch = branch;
    req.merchant = merchant;

    if (req.user.role === "admin") {
      return next();
    }

    const currentUserId = req.user._id?.toString?.() || String(req.user._id || "");
    const ownerUserId = merchant.ownerUserId?.toString?.() || String(merchant.ownerUserId || "");

    if (currentUserId && currentUserId === ownerUserId) {
      return next();
    }

    const isBranchManager = Array.isArray(branch.managerUserIds) &&
      branch.managerUserIds.some(
        (managerId) => (managerId?.toString?.() || String(managerId || "")) === currentUserId
      );

    if (isBranchManager) {
      return next();
    }

    return next(new AppError("Bạn không có quyền quản lý chi nhánh này", 403));
  } catch (error) {
    return next(error);
  }
};

module.exports = requireBranchAccess;
module.exports.requireBranchAccess = requireBranchAccess;
module.exports.default = requireBranchAccess;
