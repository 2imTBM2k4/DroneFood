import Joi from "joi";

const shippingAddressSchema = Joi.object({
  fullName: Joi.string().trim().required(),
  address: Joi.string().trim().required(),
  city: Joi.string().trim().required(),
  state: Joi.string().trim().required(),
  country: Joi.string().trim().required(),
  zipCode: Joi.string().allow("", null),
  phone: Joi.string().trim().required(),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

// NOTE: items, amount and restaurantId are accepted for backward compatibility
// with older clients but are IGNORED. The order is built from the user's
// server-side cart and priced from the database — see orderService.placeOrder.
export const placeOrderSchema = Joi.object({
  items: Joi.array().items(Joi.object().unknown(true)).optional(),
  // Raw address remains for compatibility. New clients should send an ID from
  // the address book so the server copies the verified entry into the order.
  address: shippingAddressSchema,
  addressEntryId: Joi.string().trim().hex().length(24),
  amount: Joi.number().optional(),
  paymentMethod: Joi.string()
    .valid("COD", "VNPAY", "PAYOS")
    .required()
    .messages({
      "any.only": "Phương thức thanh toán không hợp lệ (COD, PAYOS)",
      "any.required": "Phương thức thanh toán là bắt buộc",
    }),
  deliveryMethod: Joi.string().valid("shipper", "drone").required().messages({
    "any.only": "Phương thức giao hàng phải là shipper hoặc drone",
    "any.required": "Phương thức giao hàng là bắt buộc",
  }),
  voucherCode: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).min(3).max(32).allow("", null),
  voucherCodes: Joi.array().items(
    Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).min(3).max(32)
  ).max(5).optional(),
  restaurantId: Joi.alternatives()
    .try(Joi.string().trim(), Joi.object())
    .optional(),
}).or("address", "addressEntryId").messages({
  "object.missing": "Địa chỉ giao hàng là bắt buộc",
});

export const deliveryQuoteSchema = Joi.object({
  address: shippingAddressSchema,
  addressEntryId: Joi.string().trim().hex().length(24),
  deliveryMethod: placeOrderSchema.extract("deliveryMethod"),
  voucherCode: placeOrderSchema.extract("voucherCode"),
  voucherCodes: Joi.array().items(
    Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).min(3).max(32)
  ).max(5).optional(),
}).or("address", "addressEntryId").messages({
  "object.missing": "Địa chỉ giao hàng là bắt buộc",
});

export const updateStatusSchema = Joi.object({
  orderId: Joi.string().trim().required().messages({
    "any.required": "orderId là bắt buộc",
  }),
  status: Joi.string()
    .valid("pending", "preparing", "delivering", "delivered", "cancelled")
    .required()
    .messages({
      "any.only":
        "Trạng thái không hợp lệ (pending, preparing, delivering, delivered, cancelled)",
      "any.required": "Trạng thái là bắt buộc",
    }),
  reason: Joi.string().trim().max(500).allow("", null),
  isPaid: Joi.boolean(),
  paidAt: Joi.date(),
});

export const verifyOrderSchema = Joi.object({
  orderId: Joi.string().trim().required().messages({
    "any.required": "orderId là bắt buộc",
  }),
});

export const retryPayosPaymentSchema = Joi.object({
  orderId: Joi.string().trim().hex().length(24).required().messages({
    "string.hex": "orderId không hợp lệ",
    "string.length": "orderId không hợp lệ",
    "any.required": "orderId là bắt buộc",
  }),
});
