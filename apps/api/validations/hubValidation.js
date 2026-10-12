import Joi from "joi";

export const createHubSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "Tên hub là bắt buộc",
    "string.empty": "Tên hub không được để trống",
  }),
  code: Joi.string().trim().uppercase().min(2).max(30).required().messages({
    "any.required": "Mã hub (code) là bắt buộc",
    "string.empty": "Mã hub không được để trống",
  }),
  address: Joi.alternatives()
    .try(
      Joi.string().trim().min(3).max(255),
      Joi.object({
        text: Joi.string().trim().min(3).max(255).required(),
        lat: Joi.number().min(-90).max(90).optional(),
        lng: Joi.number().min(-180).max(180).optional(),
      })
    )
    .required()
    .messages({
      "any.required": "Địa chỉ hub là bắt buộc",
    }),
  capacity: Joi.number().integer().min(0).allow(null).optional(),
  note: Joi.string().trim().max(500).allow("").optional(),
});

export const updateHubSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  code: Joi.string().trim().uppercase().min(2).max(30),
  address: Joi.alternatives().try(
    Joi.string().trim().min(3).max(255),
    Joi.object({
      text: Joi.string().trim().min(3).max(255).required(),
      lat: Joi.number().min(-90).max(90).optional(),
      lng: Joi.number().min(-180).max(180).optional(),
    })
  ),
  status: Joi.string().valid("active", "inactive"),
  capacity: Joi.number().integer().min(0).allow(null),
  note: Joi.string().trim().max(500).allow(""),
});

export const listHubsQuerySchema = Joi.object({
  status: Joi.string().valid("active", "inactive"),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
