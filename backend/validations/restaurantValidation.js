import Joi from "joi";

export const createRestaurantSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "Tên nhà hàng là bắt buộc",
    "string.min": "Tên nhà hàng phải có ít nhất 2 ký tự",
  }),
  address: Joi.string().trim().max(200).allow("", null),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]{8,15}$/)
    .allow("", null)
    .messages({
      "string.pattern.base": "Số điện thoại không hợp lệ",
    }),
  email: Joi.string().trim().email().allow("", null),
  description: Joi.string().trim().max(500).allow("", null),
  openingHours: Joi.alternatives().try(
    Joi.object({
      openTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).default("07:00"),
      closeTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).default("22:00"),
    }),
    Joi.string()
  ).optional().allow(null),
  isOpen: Joi.boolean().optional(),
});

export const updateRestaurantSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  address: Joi.string().trim().max(200).allow("", null),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]{8,15}$/)
    .allow("", null),
  email: Joi.string().trim().email().allow("", null),
  description: Joi.string().trim().max(500).allow("", null),
  openingHours: Joi.alternatives().try(
    Joi.object({
      openTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
      closeTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
    }),
    Joi.string()
  ).optional().allow(null),
  isOpen: Joi.boolean().optional(),
});

export const deleteRestaurantSchema = Joi.object({
  id: Joi.string().trim().required().messages({
    "any.required": "ID nhà hàng là bắt buộc",
  }),
});

export const lockRestaurantSchema = Joi.object({
  isLocked: Joi.boolean().required().messages({
    "any.required": "isLocked là bắt buộc",
  }),
});

export const setOpenStateSchema = Joi.object({
  isOpen: Joi.boolean().required().messages({
    "any.required": "isOpen là bắt buộc",
  }),
});
