import Joi from "joi";

export const createWithdrawalSchema = Joi.object({
  amount: Joi.number().integer().min(500000).required(),
});

export const paidWithdrawalSchema = Joi.object({
  bankTransactionReference: Joi.string().trim().min(1).max(160).required(),
});

export const rejectWithdrawalSchema = Joi.object({
  reason: Joi.string().trim().max(300).allow("", null),
});
