import { RestaurantWithdrawal } from "../models/index.cjs";

export const create = async (data) => RestaurantWithdrawal.create(data);
export const findById = (id) => RestaurantWithdrawal.findById(id);
export const findByRestaurant = async (restaurantId) => RestaurantWithdrawal.find({ restaurant: restaurantId }).sort({ createdAt: -1 });
export const countForVietnamDay = async (restaurantId, start, end) =>
  RestaurantWithdrawal.countDocuments({ restaurant: restaurantId, createdAt: { $gte: start, $lt: end } });
export const approve = async (id, actorId, session) =>
  RestaurantWithdrawal.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status: "approved", approvedAt: new Date(), completedBy: actorId } },
    { new: true, session }
  );
