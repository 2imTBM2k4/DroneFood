import Joi from "joi";

const phone = Joi.string().trim().pattern(/^[0-9+\-\s()]{8,15}$/).messages({
  "string.pattern.base": "Số điện thoại không hợp lệ",
});

const fields = {
  label: Joi.string().trim().min(1).max(30),
  recipient: Joi.string().trim().min(2).max(50),
  phone,
  address: Joi.string().trim().min(3).max(200),
  city: Joi.string().trim().min(1).max(100),
  state: Joi.string().trim().min(1).max(100),
  country: Joi.string().trim().min(1).max(100),
  zipCode: Joi.string().trim().max(20).allow("", null),
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
};

export const createAddressEntrySchema = Joi.object({
  ...fields,
  label: fields.label.required(),
  recipient: fields.recipient.required(),
  phone: fields.phone.required(),
  address: fields.address.required(),
  city: fields.city.required(),
  state: fields.state.required(),
  country: fields.country.required(),
  lat: fields.lat.required(),
  lng: fields.lng.required(),
  isDefault: Joi.boolean().default(false),
});

export const updateAddressEntrySchema = Joi.object(fields).min(1);
export const addressEntryParamsSchema = Joi.object({ id: Joi.string().trim().hex().length(24).required() });
