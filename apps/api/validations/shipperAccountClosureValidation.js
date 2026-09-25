import Joi from "joi";

const bankFields = {
  bankName: Joi.string().trim().max(120).required(),
  accountHolder: Joi.string().trim().max(120).required(),
  accountNumber: Joi.string().trim().max(64).required(),
};

export const createClosureSchema = Joi.object(bankFields);
export const updateClosureBankSchema = Joi.object({ token: Joi.string().trim().required(), ...bankFields });
