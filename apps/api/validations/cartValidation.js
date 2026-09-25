import Joi from "joi";

// The client may name a group and an option, nothing more. Anything else —
// notably a priceDelta — is dropped by validate()'s stripUnknown before it
// reaches the service, which prices every option from the database.
const selectedOptionSchema = Joi.object({
  groupName: Joi.string().trim().required().messages({
    "any.required": "groupName is required for each selected option",
  }),
  optionName: Joi.string().trim().required().messages({
    "any.required": "optionName is required for each selected option",
  }),
});

export const addToCartSchema = Joi.object({
  itemId: Joi.string().trim().required().messages({
    "any.required": "itemId is required",
    "string.empty": "itemId must not be empty",
  }),
  quantity: Joi.number().integer().min(1).max(99).default(1),
  selectedOptions: Joi.array().items(selectedOptionSchema).default([]),
  note: Joi.string().trim().allow("").max(200).default("").messages({
    "string.max": "Note must be 200 characters or fewer",
  }),
});

export const updateLineSchema = Joi.object({
  lineKey: Joi.string().trim().required().messages({
    "any.required": "lineKey is required",
  }),
  // 0 removes the line.
  quantity: Joi.number().integer().min(0).max(99).required().messages({
    "any.required": "quantity is required",
  }),
});

export const lineKeySchema = Joi.object({
  lineKey: Joi.string().trim().required().messages({
    "any.required": "lineKey is required",
  }),
});
