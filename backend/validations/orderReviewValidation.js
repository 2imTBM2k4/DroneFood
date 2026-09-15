import Joi from "joi";

export const submitReviewDecisionSchema = Joi.object({
  outcome: Joi.string().valid("rated", "skipped").required(),
  rating: Joi.when("outcome", {
    is: "rated",
    then: Joi.number().integer().min(1).max(5).required(),
    otherwise: Joi.forbidden(),
  }),
  comment: Joi.when("outcome", {
    is: "rated",
    then: Joi.string().trim().max(500).allow("").optional(),
    otherwise: Joi.forbidden(),
  }),
});
