const mongoose = require("mongoose");
const { Merchant, Branch } = require("../models/index.cjs");

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

const resolveMerchantId = (req) => {
  return (
    req.params?.merchantId ||
    req.body?.merchantId ||
    req.query?.merchantId ||
    null
  );
};

const requireMerchantAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError("Yêu cầu đăng nhập để thực hiện thao tác này", 401));
    }

    let rawMerchantId = resolveMerchantId(req);
    let merchant = null;

    if (!rawMerchantId && req.params?.id) {
      const targetId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return next(new AppError("ID không hợp lệ", 400));
      }
      merchant = await Merchant.findById(targetId);
      if (!merchant) {
        // Kiểm tra xem ID có phải là branchId không
        const branch = await Branch.findById(targetId);
        if (branch) {
          req.branch = branch;
          rawMerchantId = branch.merchantId;
          merchant = await Merchant.findById(rawMerchantId);
        }
      }
    }

    if (!rawMerchantId && !merchant) {
      return next(new AppError("merchantId là bắt buộc", 400));
    }

    if (rawMerchantId && !merchant) {
      if (!mongoose.Types.ObjectId.isValid(rawMerchantId)) {
        return next(new AppError("merchantId không hợp lệ", 400));
      }
      merchant = await Merchant.findById(rawMerchantId);
    }

    if (!merchant) {
      return next(new AppError("Merchant không tồn tại", 404));
    }

    req.merchant = merchant;

    if (req.user.role === "admin") {
      return next();
    }

    const currentUserId = req.user._id?.toString?.() || String(req.user._id || "");
    const ownerUserId = merchant.ownerUserId?.toString?.() || String(merchant.ownerUserId || "");

    if (currentUserId && currentUserId === ownerUserId) {
      return next();
    }

    return next(new AppError("Bạn không có quyền quản lý merchant này", 403));
  } catch (error) {
    return next(error);
  }
};

module.exports = requireMerchantAccess;
module.exports.requireMerchantAccess = requireMerchantAccess;
module.exports.default = requireMerchantAccess;
