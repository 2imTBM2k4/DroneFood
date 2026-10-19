import Joi from "joi";

export const registerMerchantSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "Tên thương hiệu là bắt buộc",
    "string.empty": "Tên thương hiệu không được để trống",
    "string.min": "Tên thương hiệu phải có ít nhất 2 ký tự",
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
  description: Joi.string().trim().max(500).allow("", null),
  images: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim().uri().allow("", null)),
      Joi.string().trim().uri()
    )
    .optional(),
  logoUrl: Joi.string().trim().uri().allow("", null),
  coverUrl: Joi.string().trim().uri().allow("", null),
});

export const updateMerchantSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().max(500).allow("", null),
  logoUrl: Joi.string().trim().uri().allow("", null),
  coverUrl: Joi.string().trim().uri().allow("", null),
});

export const suspendMerchantSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required().messages({
    "any.required": "Lý do đình chỉ là bắt buộc",
    "string.empty": "Lý do đình chỉ không được để trống",
    "string.min": "Lý do đình chỉ phải có ít nhất 3 ký tự",
  }),
});

export const listMerchantsQuerySchema = Joi.object({
  status: Joi.string().valid("pending", "active", "suspended"),
  type: Joi.string().valid("individual", "brand"),
  q: Joi.string().trim().max(100).allow(""),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string()
    .valid("name", "type", "branchCount", "status", "owner", "createdAt")
    .optional(),
  order: Joi.string().valid("asc", "desc").optional(),
});

export const submitBrandApplicationSchema = Joi.object({
  brandName: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "Tên thương hiệu là bắt buộc",
    "string.empty": "Tên thương hiệu không được để trống",
    "string.min": "Tên thương hiệu phải có ít nhất 2 ký tự",
  }),
  taxCode: Joi.string().trim().max(50).allow("", null),
  representativeName: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "Tên người đại diện là bắt buộc",
    "string.empty": "Tên người đại diện không được để trống",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]{8,15}$/)
    .required()
    .messages({
      "any.required": "Số điện thoại liên hệ là bắt buộc",
      "string.pattern.base": "Số điện thoại không hợp lệ",
    }),
  licenseImages: Joi.array().items(Joi.string().trim().allow("", null)).optional(),
  notes: Joi.string().trim().max(1000).allow("", null),
});

export const decideBrandApplicationSchema = Joi.object({
  decision: Joi.string().valid("approved", "rejected").required().messages({
    "any.required": "Quyết định phê duyệt là bắt buộc",
    "any.only": "Quyết định phải là approved hoặc rejected",
  }),
  reason: Joi.when("decision", {
    is: "rejected",
    then: Joi.string().trim().min(3).max(500).required().messages({
      "any.required": "Lý do từ chối là bắt buộc khi từ chối hồ sơ",
      "string.empty": "Lý do từ chối không được để trống",
      "string.min": "Lý do từ chối phải có ít nhất 3 ký tự",
    }),
    otherwise: Joi.string().trim().max(500).allow("", null),
  }),
});
