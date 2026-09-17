import Joi from "joi";

const token = Joi.string().trim().max(255).required();

export const registerPushTokenSchema = Joi.object({
  token,
  platform: Joi.string().valid("android", "ios").required(),
});

export const unregisterPushTokenSchema = Joi.object({ token });
