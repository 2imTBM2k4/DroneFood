import Joi from "joi";

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "Tên không được để trống",
    "string.min": "Tên phải có ít nhất 2 ký tự",
    "string.max": "Tên không được quá 50 ký tự",
    "any.required": "Tên là bắt buộc",
  }),
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Email là bắt buộc",
  }),
  password: Joi.string().min(8).max(128).required().messages({
    "string.min": "Mật khẩu phải có ít nhất 8 ký tự",
    "any.required": "Mật khẩu là bắt buộc",
  }),
  role: Joi.string().valid("user", "restaurant_owner", "shipper").default("user"),
  restaurantName: Joi.when("role", {
    is: "restaurant_owner",
    then: Joi.string().trim().min(2).max(100).required().messages({
      "any.required": "Tên nhà hàng là bắt buộc khi đăng ký làm chủ nhà hàng",
    }),
    otherwise: Joi.string().allow("", null),
  }),
  address: Joi.string().trim().max(200).allow("", null),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]{8,15}$/)
    .allow("", null)
    .messages({
      "string.pattern.base": "Số điện thoại không hợp lệ",
    }),
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Email là bắt buộc",
  }),
  password: Joi.string().required().messages({
    "any.required": "Mật khẩu là bắt buộc",
  }),
});

export const updateAddressSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(50).required().messages({
    "any.required": "Họ tên là bắt buộc",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]{8,15}$/)
    .required()
    .messages({
      "string.pattern.base": "Số điện thoại không hợp lệ",
      "any.required": "Số điện thoại là bắt buộc",
    }),
  address: Joi.string().trim().max(200).required().messages({
    "any.required": "Địa chỉ là bắt buộc",
  }),
  city: Joi.string().trim().max(100).allow("", null),
  state: Joi.string().trim().max(100).allow("", null),
  country: Joi.string().trim().max(100).allow("", null),
  zipCode: Joi.string().trim().max(20).allow("", null),
  lat: Joi.number().min(-90).max(90).allow(null),
  lng: Joi.number().min(-180).max(180).allow(null),
});

export const reverseGeocodeQuerySchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

export const geocodeAddressQuerySchema = Joi.object({
  address: Joi.string().trim().min(3).max(500).required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Vui lòng nhập mật khẩu hiện tại",
    "string.empty": "Vui lòng nhập mật khẩu hiện tại",
  }),
  newPassword: Joi.string().min(8).max(128).required().messages({
    "string.min": "Mật khẩu mới phải có ít nhất 8 ký tự",
    "any.required": "Vui lòng nhập mật khẩu mới",
  }),
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).messages({
    "string.min": "Tên phải có ít nhất 2 ký tự",
  }),
  email: Joi.string().trim().email().messages({
    "string.email": "Email không hợp lệ",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]{8,15}$/)
    .allow("", null)
    .messages({
      "string.pattern.base": "Số điện thoại không hợp lệ",
    }),
});

export const lockUserSchema = Joi.object({
  id: Joi.string().trim(),
  userId: Joi.string().trim(),
  locked: Joi.boolean(),
  lock: Joi.boolean(),
})
  .or("id", "userId")
  .or("locked", "lock")
  .messages({
    "object.missing": "Thiếu userId hoặc trạng thái lock",
  });

export const updateByAdminSchema = Joi.object({
  userId: Joi.string().trim().required().messages({
    "any.required": "userId là bắt buộc",
  }),
  name: Joi.string().trim().min(2).max(50),
  email: Joi.string().trim().email(),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]{8,15}$/)
    .allow("", null),
  // Explicitly forbidden rather than merely absent: an admin who can set
  // someone's password can take over their account. Rejecting it loudly beats
  // silently stripping it, which would look like the change had worked.
  password: Joi.any().forbidden().messages({
    "any.unknown":
      "Admins cannot set a user's password. Ask the user to reset it by email.",
  }),
  role: Joi.string().valid("user", "restaurant_owner", "shipper", "admin"),
  locked: Joi.boolean(),
});

export const deleteUserSchema = Joi.object({
  userId: Joi.string().trim().required().messages({
    "any.required": "userId là bắt buộc",
  }),
});

export const statsQuerySchema = Joi.object({
  period: Joi.string().valid("day", "month").default("day"),
});
