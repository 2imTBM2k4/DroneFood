import mongoose from "mongoose";
import { Order } from "../models/index.cjs";
import * as reviewRepo from "../repositories/orderReviewRepository.js";
import AppError from "../utils/AppError.js";
import { recordAudit } from "../utils/auditLog.js";

const idOf = (value) => String(value?._id || value || "");
const isDelivered = (order) => order.orderStatus === "delivered" && order.isDelivered === true;

const reviewStepsFor = (order) => {
  const steps = [];
  if (order.deliveryMethod === "shipper" && order.shipperId) {
    steps.push({ targetType: "shipper", target: order.shipperId, name: order.shipperId.name || "tài xế" });
  }

  const seenFoodIds = new Set();
  (order.orderItems || []).forEach((item) => {
    const foodId = idOf(item.product);
    if (!foodId || seenFoodIds.has(foodId)) return;
    seenFoodIds.add(foodId);
    steps.push({ targetType: "food", target: item.product, name: item.name || "món ăn" });
  });
  return steps;
};

export const attachReviewFlows = async (orders) => {
  if (orders.length === 0) return [];
  const reviews = await reviewRepo.findByOrders(orders.map((order) => order._id));
  const reviewByTarget = new Map(
    reviews.map((review) => [`${idOf(review.order)}:${review.targetType}:${idOf(review.target)}`, review])
  );

  return orders.map((order) => {
    const targets = reviewStepsFor(order).map((step) => {
      if (!isDelivered(order)) return { ...step, targetId: idOf(step.target), status: "not_applicable" };
      const review = reviewByTarget.get(`${idOf(order._id)}:${step.targetType}:${idOf(step.target)}`);
      return {
        targetType: step.targetType,
        targetId: idOf(step.target),
        name: step.name,
        status: review ? review.outcome : "pending",
        ...(review?.outcome === "rated" && { rating: review.rating, comment: review.comment }),
      };
    });
    const nextTarget = targets.find((target) => target.status === "pending") || null;
    return { targets, nextTarget, complete: isDelivered(order) && !nextTarget };
  });
};

export const submitReviewDecision = async (user, orderId, targetType, targetId, outcome, rating, comment = "") => {
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(targetId)) {
    throw new AppError("Invalid review target", 400);
  }
  const order = await Order.findOne({ _id: orderId, user: user._id })
    .populate("shipperId", "name")
    .populate("restaurantId", "name")
    .populate("orderItems.product", "name");
  if (!order) throw new AppError("Order not found", 404);
  if (!isDelivered(order)) throw new AppError("You can only review a completed order", 409);

  const steps = reviewStepsFor(order);
  const stepIndex = steps.findIndex(
    (step) => step.targetType === targetType && idOf(step.target) === String(targetId)
  );
  if (stepIndex < 0) throw new AppError("This review target does not belong to the order", 400);
  const previousStep = steps[stepIndex - 1];
  if (previousStep) {
    const previousDecision = await reviewRepo.findByOrderAndTarget(order._id, previousStep.targetType, previousStep.target);
    if (!previousDecision) throw new AppError("Please complete or skip the previous review first", 409);
  }
  if (outcome === "rated" && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new AppError("Rating must be an integer from 1 to 5", 400);
  }
  if (targetType !== "food" && comment.trim()) {
    throw new AppError("Comments can only be left for food items", 400);
  }

  const existing = await reviewRepo.findByOrderAndTarget(order._id, targetType, targetId);
  if (existing) throw new AppError("This review decision has already been recorded", 409);

  try {
    await reviewRepo.create({
      order: order._id,
      reviewer: user._id,
      targetType,
      target: targetId,
      restaurant: targetType === "food" ? order.restaurantId : null,
      outcome,
      rating: outcome === "rated" ? rating : null,
      comment: outcome === "rated" && targetType === "food" ? comment.trim() : "",
    });
  } catch (error) {
    if (error?.code === 11000) throw new AppError("This review decision has already been recorded", 409);
    throw error;
  }

  await recordAudit({
    actor: user,
    action: outcome === "rated" ? "order.review_submitted" : "order.review_skipped",
    targetType: "order",
    targetId: order._id,
    metadata: { reviewTarget: targetType, reviewTargetId: targetId, ...(outcome === "rated" && { rating }) },
  });
  const [reviewFlow] = await attachReviewFlows([order]);
  return { success: true, data: { reviewFlow } };
};

export const getRestaurantRatingSummaries = async (restaurantIds) => {
  const summaries = await reviewRepo.aggregateRestaurantRatings(restaurantIds);
  return new Map(summaries.map((summary) => [idOf(summary._id), {
    averageRating: Math.round(summary.averageRating * 10) / 10,
    ratingCount: summary.ratingCount,
  }]));
};

export const getFoodReviews = async (foodId) => {
  if (!mongoose.isValidObjectId(foodId)) throw new AppError("Invalid food id", 400);
  const reviews = await reviewRepo.findRatedFoodReviews(foodId);
  const ratingCount = reviews.length;
  const averageRating = ratingCount
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount) * 10) / 10
    : null;
  return {
    success: true,
    data: {
      averageRating,
      ratingCount,
      reviews: reviews.map((review) => ({
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        reviewerName: review.reviewer?.name || "Khách hàng",
        createdAt: review.createdAt,
      })),
    },
  };
};
