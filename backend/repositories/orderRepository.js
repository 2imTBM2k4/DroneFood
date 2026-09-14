// backend/repositories/orderRepository.js
import { Order } from "../models/index.cjs";

export const create = async (orderData, { session } = {}) => {
  const { totalPrice, paymentMethod, restaurantId } = orderData;
  if (totalPrice <= 0 || !paymentMethod || !restaurantId) {
    throw new Error("Invalid order data");
  }
  const order = new Order(orderData);
  return await order.save({ session });
};

export const findById = async (id) => {
  return await Order.findById(id)
    .populate("user")
    .populate("orderItems.product") // Ref "Food"
    .populate("restaurantId");
};

export const findByPayosOrderCode = async (payosOrderCode) => {
  return await Order.findOne({ payosOrderCode })
    .populate("user")
    .populate("orderItems.product")
    .populate("restaurantId");
};

export const findByUser = async (userId) => {
  return await Order.find({ user: userId })
    .populate("orderItems.product")
    .populate("restaurantId")
    .sort({ createdAt: -1 }); // Recent first
};

export const findAll = async (filter = {}, { page, limit } = {}) => {
  let query = Order.find(filter)
    .populate("user", "name email")
    .populate("orderItems.product")
    .populate("restaurantId")
    .sort({ createdAt: -1 });

  if (page && limit) {
    const total = await Order.countDocuments(filter);
    const data = await query.skip((page - 1) * limit).limit(limit);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  const data = await query;
  return { data };
};

export const updateById = async (id, updates, { session } = {}) => {
  // Handle specific updates like orderStatus enum
  if (
    updates.orderStatus &&
    !["pending_payment", "pending", "refund_pending", "preparing", "delivering", "delivered", "cancelled"].includes(
      updates.orderStatus
    )
  ) {
    throw new Error("Invalid order status");
  }
  return await Order.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
    session,
  }).populate("orderItems.product");
};

export const deleteById = async (id) => {
  return await Order.findByIdAndDelete(id);
};

export const aggregateStatusStats = async () => {
  return await Order.aggregate([
    {
      $group: {
        _id: "$orderStatus",
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        name: {
          $concat: [
            { $toUpper: { $substr: ["$_id", 0, 1] } },
            { $substr: ["$_id", 1, -1] },
          ],
        }, // Capitalize first letter
        value: "$count",
        _id: 0,
      },
    },
  ]);
};
