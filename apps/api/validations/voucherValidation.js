import Joi from "joi";

const money = Joi.number().integer().positive();

const voucherFields = {
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).min(3).max(32),
  kind: Joi.string().valid("fixed", "percent"),
  value: money,
  appliesTo: Joi.string().valid("items_subtotal", "shipping_fee"),
  minOrderAmount: Joi.number().integer().min(0),
  maxDiscountAmount: money.allow(null),
  startsAt: Joi.date().iso(),
  endsAt: Joi.date().iso(),
  totalQuota: Joi.number().integer().positive(),
  perUserQuota: Joi.number().integer().positive(),
  enabled: Joi.boolean(),
};

const voucherRule = (value, helpers) => {
  if (value.kind === "percent" && !value.maxDiscountAmount) {
    return helpers.error("any.invalid");
  }
  if (value.kind === "percent" && value.value > 100) {
    return helpers.error("any.invalid");
  }
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
    return helpers.error("any.invalid");
  }
  if (value.totalQuota && value.perUserQuota && value.perUserQuota > value.totalQuota) {
    return helpers.error("any.invalid");
  }
  return value;
};

export const createVoucherSchema = Joi.object(voucherFields)
  .fork(["code", "kind", "value", "appliesTo", "startsAt", "endsAt", "totalQuota", "perUserQuota"], (field) => field.required())
  .custom(voucherRule)
  .messages({ "any.invalid": "Voucher percentage, thời gian hoặc quota không hợp lệ" });

export const updateVoucherSchema = Joi.object(voucherFields)
  .min(1)
  .custom(voucherRule)
  .messages({ "any.invalid": "Voucher percentage, thời gian hoặc quota không hợp lệ" });

export const listVoucherQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  enabled: Joi.boolean(),
});

export const voucherIdParamSchema = Joi.object({ id: Joi.string().trim().required() });

export const voucherEnabledSchema = Joi.object({ enabled: Joi.boolean().required() });
