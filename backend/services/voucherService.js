import AppError from "../utils/AppError.js";
import * as voucherRepo from "../repositories/voucherRepository.js";

const normalizeCode = (code) => String(code || "").trim().toUpperCase();

const publicVoucher = (voucher) => ({
  id: voucher._id,
  code: voucher.code,
  kind: voucher.kind,
  value: voucher.value,
  appliesTo: voucher.appliesTo,
  minOrderAmount: voucher.minOrderAmount,
  maxDiscountAmount: voucher.maxDiscountAmount,
  startsAt: voucher.startsAt,
  endsAt: voucher.endsAt,
  totalQuota: voucher.totalQuota,
  perUserQuota: voucher.perUserQuota,
  usageCount: voucher.usageCount,
  enabled: voucher.enabled,
  createdAt: voucher.createdAt,
  updatedAt: voucher.updatedAt,
});

export const createVoucher = async (admin, data) => {
  const code = normalizeCode(data.code);
  const existing = await voucherRepo.findByCode(code);
  if (existing) throw new AppError("Voucher code already exists", 409);
  const voucher = await voucherRepo.create({ ...data, code, createdBy: admin._id });
  return publicVoucher(voucher);
};

export const listVouchers = async (query) => {
  const result = await voucherRepo.findAll(query);
  return { ...result, data: result.data.map(publicVoucher) };
};

export const updateVoucher = async (id, changes) => {
  if (changes.code) {
    const code = normalizeCode(changes.code);
    const duplicate = await voucherRepo.findByCode(code);
    if (duplicate && String(duplicate._id) !== String(id)) {
      throw new AppError("Voucher code already exists", 409);
    }
    changes.code = code;
  }
  const voucher = await voucherRepo.updateById(id, changes);
  if (!voucher) throw new AppError("Voucher not found", 404);
  return publicVoucher(voucher);
};

export const setVoucherEnabled = (id, enabled) => updateVoucher(id, { enabled });

export const validateVoucherForOrder = async ({ code, userId, itemsPrice, shippingPrice, now = new Date() }) => {
  const voucher = await voucherRepo.findByCode(normalizeCode(code));
  if (!voucher || !voucher.enabled) throw new AppError("Voucher is unavailable", 409);
  if (voucher.startsAt > now || voucher.endsAt < now) throw new AppError("Voucher is not active at this time", 409);
  if (voucher.usageCount >= voucher.totalQuota) throw new AppError("Voucher quota has been used", 409);
  if (itemsPrice < voucher.minOrderAmount) throw new AppError("Order does not meet the voucher minimum", 409);

  const targetAmount = voucher.appliesTo === "shipping_fee" ? shippingPrice : itemsPrice;
  if (targetAmount <= 0) throw new AppError("Voucher cannot be applied to a zero amount", 409);

  const rawDiscount = voucher.kind === "percent"
    ? Math.floor((targetAmount * voucher.value) / 100)
    : voucher.value;
  const discountAmount = Math.min(rawDiscount, voucher.maxDiscountAmount || Infinity, targetAmount);
  if (discountAmount <= 0) throw new AppError("Voucher does not produce a discount", 409);

  return {
    voucher,
    snapshot: {
      voucherId: voucher._id,
      code: voucher.code,
      kind: voucher.kind,
      value: voucher.value,
      appliesTo: voucher.appliesTo,
      minOrderAmount: voucher.minOrderAmount,
      maxDiscountAmount: voucher.maxDiscountAmount,
    },
    discountAmount,
    targetAmount,
    userId,
  };
};

export { normalizeCode, publicVoucher };
