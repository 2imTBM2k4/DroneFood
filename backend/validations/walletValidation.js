import Joi from "joi";

export const depositPaymentSchema = Joi.object({
  amount: Joi.number().integer().positive().required(),
});
