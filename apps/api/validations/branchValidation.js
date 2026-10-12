import Joi from "joi";

const objectIdSchema = Joi.string().trim().hex().length(24).messages({
  "string.hex": "ID phải là MongoDB ObjectId hợp lệ",
  "string.length": "ID phải là MongoDB ObjectId hợp lệ",
});

const operatingHourSchema = Joi.object({
  day: Joi.number().integer().min(0).max(6).required(),
  open: Joi.string()
    .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
    .required()
    .messages({
      "string.pattern.base": "Giờ mở cửa phải có định dạng HH:mm",
    }),
  close: Joi.string()
    .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
    .required()
    .messages({
      "string.pattern.base": "Giờ đóng cửa phải có định dạng HH:mm",
    }),
});

export const nearbyBranchesQuerySchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required().messages({
    "any.required": "Vĩ độ lat là bắt buộc",
    "number.base": "Vĩ độ lat phải là số",
    "number.min": "Vĩ độ lat phải từ -90 đến 90",
    "number.max": "Vĩ độ lat phải từ -90 đến 90",
  }),
  lng: Joi.number().min(-180).max(180).required().messages({
    "any.required": "Kinh độ lng là bắt buộc",
    "number.base": "Kinh độ lng phải là số",
    "number.min": "Kinh độ lng phải từ -180 đến 180",
    "number.max": "Kinh độ lng phải từ -180 đến 180",
  }),
  radius: Joi.number().min(0).optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

export const listBranchesQuerySchema = Joi.object({
  merchantId: objectIdSchema.optional(),
  status: Joi.string().valid("pending", "active", "locked"),
  droneDeliveryEnabled: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .optional(),
  q: Joi.string().trim().max(100).allow(""),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  sortBy: Joi.string()
    .valid(
      "name",
      "code",
      "merchant",
      "address",
      "status",
      "droneDeliveryEnabled",
      "createdAt"
    )
    .optional(),
  order: Joi.string().valid("asc", "desc").optional(),
});

export const createBranchSchema = Joi.object({
  merchantId: objectIdSchema.required().messages({
    "any.required": "merchantId là bắt buộc",
  }),
  name: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "Tên chi nhánh là bắt buộc",
    "string.empty": "Tên chi nhánh không được để trống",
  }),
  code: Joi.string().trim().uppercase().min(1).max(20).required().messages({
    "any.required": "Mã chi nhánh (code) là bắt buộc",
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
      "any.required": "Địa chỉ là bắt buộc",
    }),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]{8,15}$/)
    .allow("", null)
    .messages({
      "string.pattern.base": "Số điện thoại không hợp lệ",
    }),
  deliveryRadiusKm: Joi.number().min(0).allow(null).optional(),
  operatingHours: Joi.array().items(operatingHourSchema).optional(),
  images: Joi.array().items(Joi.string().trim().uri().allow("", null)).optional(),
});

export const updateBranchSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]{8,15}$/)
    .allow("", null),
  deliveryRadiusKm: Joi.number().min(0).allow(null),
  operatingHours: Joi.array().items(operatingHourSchema),
  images: Joi.array().items(Joi.string().trim().uri().allow("", null)),
  address: Joi.alternatives()
    .try(
      Joi.string().trim().min(3).max(255),
      Joi.object({
        text: Joi.string().trim().min(3).max(255).required(),
        lat: Joi.number().min(-90).max(90).optional(),
        lng: Joi.number().min(-180).max(180).optional(),
      })
    )
    .optional(),
});

export const setBranchOpenStateSchema = Joi.object({
  isOpen: Joi.boolean().required().messages({
    "any.required": "isOpen là bắt buộc (true/false)",
  }),
});

export const assignBranchManagersSchema = Joi.object({
  userIds: Joi.array().items(objectIdSchema).required().messages({
    "any.required": "userIds là bắt buộc",
  }),
});

export const lockBranchSchema = Joi.object({
  isLocked: Joi.boolean().required().messages({
    "any.required": "isLocked là bắt buộc (true/false)",
  }),
  reason: Joi.string().trim().max(500).optional().allow("", null),
});

export const setDroneDeliverySchema = Joi.object({
  enabled: Joi.boolean().required().messages({
    "any.required": "enabled là bắt buộc (true/false)",
  }),
});
