import Joi from "joi";

export const bankAccountSchema = Joi.object({
  bankName: Joi.string().trim().min(2).max(100).required(),
  accountHolder: Joi.string().trim().min(2).max(120).required(),
  accountNumber: Joi.string().trim().pattern(/^[0-9\s]{6,30}$/).required().messages({
    "string.pattern.base": "Số tài khoản chỉ được chứa chữ số",
  }),
});
