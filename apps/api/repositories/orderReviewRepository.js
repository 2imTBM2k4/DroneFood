import { OrderReview } from "../models/index.cjs";

export const findByOrders = (orderIds) =>
  OrderReview.find({ order: { $in: orderIds } }).lean();

export const findByOrderAndTarget = (orderId, targetType, target) =>
  OrderReview.findOne({ order: orderId, targetType, target }).lean();

export const create = (data) => OrderReview.create(data);

export const aggregateRestaurantRatings = (restaurantIds) =>
  OrderReview.aggregate([
    {
      $match: {
        targetType: "food",
        restaurant: { $in: restaurantIds },
        outcome: "rated",
      },
    },
    {
      $group: {
        _id: "$restaurant",
        averageRating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

export const findRatedFoodReviews = (foodId) =>
  OrderReview.find({ targetType: "food", target: foodId, outcome: "rated" })
    .populate("reviewer", "name")
    .sort({ createdAt: -1 })
    .lean();
