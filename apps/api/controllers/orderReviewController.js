import * as orderReviewService from "../services/orderReviewService.js";

export const submitDecision = async (req, res) => {
  try {
    const result = await orderReviewService.submitReviewDecision(
      req.user,
      req.params.orderId,
      req.params.targetType,
      req.params.targetId,
      req.body.outcome,
      req.body.rating,
      req.body.comment
    );
    res.status(201).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const listFoodReviews = async (req, res) => {
  try {
    res.json(await orderReviewService.getFoodReviews(req.params.foodId));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
