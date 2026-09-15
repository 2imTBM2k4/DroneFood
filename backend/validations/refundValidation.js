import Joi from "joi";

const bank = Joi.object({
  bankName: Joi.string().trim().max(100).required(),
  accountNumber: Joi.string().trim().pattern(/^[0-9A-Za-z-]{6,34}$/).required(),
  accountHolder: Joi.string().trim().max(120).required(),
});

export const requestRefundSchema = Joi.object({
  orderId: Joi.string().trim().required(),
  reason: Joi.string().trim().max(500).required(),
  bank: bank.required(),
});

export const refundIdParamSchema = Joi.object({ id: Joi.string().trim().required() });
export const refundListQuerySchema = Joi.object({ status: Joi.string().valid("requested", "paid", "rejected") });
export const markRefundPaidSchema = Joi.object({
  transferReference: Joi.string().trim().max(100).required(),
  adminNote: Joi.string().trim().max(500).allow(""),
});
export const rejectRefundSchema = Joi.object({ adminNote: Joi.string().trim().max(500).required() });
