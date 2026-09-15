import { RestaurantWithdrawal } from "../models/index.cjs";

export const create = async (data, session) => RestaurantWithdrawal.create([data], { session }).then(([request]) => request);
export const findById = (id) => RestaurantWithdrawal.findById(id);
export const findByRestaurant = async (restaurantId) => RestaurantWithdrawal.find({ restaurant: restaurantId }).sort({ createdAt: -1 });
export const findByShipper = async (shipperId) => RestaurantWithdrawal.find({ shipper: shipperId }).sort({ createdAt: -1 });
export const findAll = async (filters = {}) => RestaurantWithdrawal.find(filters)
  .populate("restaurant", "name")
  .populate("shipper", "name email phone")
  .sort({ createdAt: -1 });
export const countForVietnamDay = async (restaurantId, start, end) =>
  RestaurantWithdrawal.countDocuments({ restaurant: restaurantId, createdAt: { $gte: start, $lt: end } });
export const countForShipperVietnamDay = async (shipperId, start, end) =>
  RestaurantWithdrawal.countDocuments({ shipper: shipperId, createdAt: { $gte: start, $lt: end } });
export const approve = async (id, actorId, session) =>
  RestaurantWithdrawal.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status: "approved", approvedAt: new Date(), approvedBy: actorId } },
    { new: true, session }
  );
export const reject = async (id, actorId, reason, session) =>
  RestaurantWithdrawal.findOneAndUpdate(
    { _id: id, status: { $in: ["pending", "approved"] } },
    { $set: { status: "rejected", rejectedAt: new Date(), rejectedBy: actorId, rejectionReason: reason || null, reservedAmount: 0 } },
    { new: true, session }
  );
export const markPaid = async (id, actorId, bankTransactionReference, session) =>
  RestaurantWithdrawal.findOneAndUpdate(
    { _id: id, status: "approved" },
    { $set: { status: "paid", paidAt: new Date(), paidBy: actorId, bankTransactionReference, reservedAmount: 0 } },
    { new: true, session }
  );
