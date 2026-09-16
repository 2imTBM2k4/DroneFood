import Joi from "joi";

export const notificationListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

export const notificationIdParamSchema = Joi.object({ id: Joi.string().trim().hex().length(24).required() });
