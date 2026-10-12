import Joi from "joi";

export const createDroneSchema = Joi.object({
  hubId: Joi.string().trim().hex().length(24).required().messages({
    "any.required": "hubId là bắt buộc",
    "string.empty": "hubId không được để trống",
    "string.hex": "hubId phải là MongoDB ObjectId hợp lệ",
    "string.length": "hubId phải là MongoDB ObjectId hợp lệ",
  }),
  droneCode: Joi.string().trim().min(1).max(50).required().messages({
    "any.required": "Mã drone là bắt buộc",
    "string.empty": "Mã drone không được để trống",
  }),
  cargoWeight: Joi.number().min(0).default(0),
  status: Joi.string()
    .valid("available", "flying_to_branch", "delivering", "returning_to_hub", "maintenance")
    .default("available"),
  cargoLidStatus: Joi.string().valid("open", "closed").default("closed"),
  batteryLevel: Joi.number().min(0).max(100).default(100),
  lastMaintenance: Joi.date().allow(null),
});

export const updateDroneSchema = Joi.object({
  droneCode: Joi.string().trim().min(1).max(50),
  hubId: Joi.string().trim().hex().length(24),
  cargoWeight: Joi.number().min(0),
  status: Joi.string().valid(
    "available",
    "flying_to_branch",
    "delivering",
    "returning_to_hub",
    "maintenance"
  ),
  cargoLidStatus: Joi.string().valid("open", "closed"),
  batteryLevel: Joi.number().min(0).max(100),
  lastMaintenance: Joi.date().allow(null),
});

export const updateDroneStatusSchema = Joi.object({
  status: Joi.string()
    .valid("available", "flying_to_branch", "delivering", "returning_to_hub", "maintenance")
    .required()
    .messages({
      "any.required": "Trạng thái drone là bắt buộc",
    }),
});

export const assignDroneSchema = Joi.object({
  orderId: Joi.string().trim().required().messages({
    "any.required": "orderId là bắt buộc",
  }),
  droneId: Joi.string().trim().hex().length(24).optional().messages({
    "string.hex": "droneId phải là MongoDB ObjectId hợp lệ",
    "string.length": "droneId phải là MongoDB ObjectId hợp lệ",
  }),
});

export const scanQRSchema = Joi.object({
  orderId: Joi.string().trim().required().messages({
    "any.required": "orderId là bắt buộc",
  }),
  qrCode: Joi.string().trim().required().messages({
    "any.required": "QR code là bắt buộc",
  }),
});

export const confirmDeliverySchema = Joi.object({
  orderId: Joi.string().trim().required().messages({
    "any.required": "orderId là bắt buộc",
  }),
});

export const cargoWeightSchema = Joi.object({
  droneId: Joi.string().trim().required().messages({
    "any.required": "droneId là bắt buộc",
  }),
  weight: Joi.number().min(0).required().messages({
    "number.base": "Trọng lượng phải là số",
    "any.required": "Trọng lượng là bắt buộc",
  }),
});

export const historyQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const reassignDroneSchema = Joi.object({
  orderId: Joi.string().trim().required().messages({
    "any.required": "orderId là bắt buộc",
  }),
  droneId: Joi.string().trim().required().messages({
    "any.required": "droneId là bắt buộc",
  }),
  reason: Joi.string().trim().min(3).max(500).required().messages({
    "any.required": "Lý do đổi drone là bắt buộc",
    "string.min": "Lý do quá ngắn",
  }),
});

export const preflightCheckSchema = Joi.object({
  orderId: Joi.string().trim().required().messages({
    "any.required": "orderId là bắt buộc",
  }),
  passed: Joi.boolean().required().messages({
    "any.required": "passed là bắt buộc (true/false)",
  }),
  checklist: Joi.object().optional(),
  notes: Joi.string().trim().max(500).allow("").optional(),
});

export const orderTargetSchema = Joi.object({
  orderId: Joi.string().trim().required().messages({
    "any.required": "orderId là bắt buộc",
  }),
});

export const fallbackConsentSchema = Joi.object({
  orderId: Joi.string().trim().required().messages({
    "any.required": "orderId là bắt buộc",
  }),
  consent: Joi.string().valid("accept_shipper", "reject").required().messages({
    "any.required": "consent là bắt buộc (accept_shipper hoặc reject)",
    "any.only": "consent phải là 'accept_shipper' hoặc 'reject'",
  }),
});

