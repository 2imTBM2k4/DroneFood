import Joi from "joi";

export const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  pushToken: Joi.string().trim().max(512).allow("", null),
});

export const statusSchema = Joi.object({
  status: Joi.string().valid("offline", "available").required(),
});

export const approvalSchema = Joi.object({
  approvalStatus: Joi.string().valid("approved", "rejected").required(),
});

export const declineSchema = Joi.object({
  reason: Joi.string().trim().max(300).allow("", null),
});
