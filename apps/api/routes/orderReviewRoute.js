import express from "express";
import { protect } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { submitReviewDecisionSchema } from "../validations/orderReviewValidation.js";
import { listFoodReviews, submitDecision } from "../controllers/orderReviewController.js";

const router = express.Router();

router.get("/food/:foodId", listFoodReviews);

router.post(
  "/:orderId/:targetType/:targetId",
  protect,
  validate(submitReviewDecisionSchema),
  submitDecision
);

export default router;
