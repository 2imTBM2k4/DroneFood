// backend/repositories/orderRepository.js
import { Order } from "../models/index.cjs";

export const create = async (orderData, { session } = {}) => {
  const { totalPrice, paymentMethod, restaurantId, isPaid, paymentResult } = orderData;
  const isZeroPayableVoucherOrder = Number(totalPrice) === 0 &&
    paymentMethod === "PAYOS" &&
    isPaid === true &&
    paymentResult?.status === "ZERO_PAYABLE_VOUCHER";
  if (!Number.isFinite(totalPrice) || (totalPrice <= 0 && !isZeroPayableVoucherOrder) || !paymentMethod || !restaurantId) {
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
    .populate("shipperId", "name")
    .sort({ createdAt: -1 }); // Recent first
};

// Customer-facing detail lookup keeps the ownership condition in the query so
// a valid order id belonging to somebody else is indistinguishable from a
// missing order.  Populate only the contact/location fields shown on the
// tracking screen; do not expose account or wallet data through this route.
export const findCustomerDetail = async (userId, orderId) => {
  return await Order.findOne({ _id: orderId, user: userId })
    .populate("orderItems.product")
    .populate("restaurantId", "name address lat lng")
    .populate("shipperId", "name phone");
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
    !["pending_payment", "pending", "refund_pending", "preparing", "delivering", "arrived_at_delivery", "delivered", "cancelled"].includes(
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

// A conditional transition is the cancellation claim: only the request that
// still sees the expected active state may pair cancellation with releasing
// its voucher reservations inside the same transaction.
export const claimZeroPayableVoucherCancellation = async ({ orderId, expectedStatus, reason, isDrone }, { session } = {}) =>
  Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentMethod: "PAYOS",
      isPaid: true,
      totalPrice: 0,
      "paymentResult.status": "ZERO_PAYABLE_VOUCHER",
      orderStatus: expectedStatus,
    },
    {
      $set: {
        orderStatus: "cancelled",
        reason,
        ...(isDrone && { dronePhase: "cancelled" }),
      },
    },
    { new: true, session, runValidators: true }
  );

// The sentinel makes retry creation an atomic claim: two browser tabs cannot
// both replace one unpaid link with separate active PayOS links.
export const claimPayosRetry = async ({
  orderId,
  userId,
  previousOrderCode,
  previousPaymentLinkId,
  nextOrderCode,
}) => {
  return await Order.findOneAndUpdate(
    {
      _id: orderId,
      user: userId,
      paymentMethod: "PAYOS",
      isPaid: false,
      orderStatus: "pending_payment",
      payosOrderCode: previousOrderCode,
      payosPaymentLinkId: previousPaymentLinkId,
    },
    { $set: { payosOrderCode: nextOrderCode, payosPaymentLinkId: "__retrying__" } },
    { new: true, runValidators: true }
  ).populate("orderItems.product");
};

export const finishPayosRetry = async ({ orderId, nextOrderCode, paymentLinkId }) => {
  return await Order.findOneAndUpdate(
    { _id: orderId, payosOrderCode: nextOrderCode, payosPaymentLinkId: "__retrying__" },
    { $set: { payosPaymentLinkId: paymentLinkId } },
    { new: true, runValidators: true }
  );
};

export const restorePayosRetry = async ({
  orderId,
  nextOrderCode,
  previousOrderCode,
  previousPaymentLinkId,
}) => {
  return await Order.findOneAndUpdate(
    { _id: orderId, payosOrderCode: nextOrderCode, payosPaymentLinkId: "__retrying__" },
    {
      $set: {
        payosOrderCode: previousOrderCode,
        payosPaymentLinkId: previousPaymentLinkId,
      },
    },
    { new: true, runValidators: true }
  );
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
