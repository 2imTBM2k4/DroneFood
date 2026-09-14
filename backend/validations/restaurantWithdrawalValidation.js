import Joi from "joi";

export const createWithdrawalSchema = Joi.object({
  amount: Joi.number().integer().min(500000).required(),
});
