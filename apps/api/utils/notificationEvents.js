import { Order, Restaurant, User } from "../models/index.cjs";
import { createAndEmit } from "../services/notificationService.js";

const safelyNotify = async (io, draft) => {
  try { return await createAndEmit(io, draft); }
  catch (error) { console.error("Notification delivery failed:", error.message); return null; }
};

const orderPath = (orderId) => `/myorders/${orderId}`;

export const notifyRestaurantNewOrder = async (io, orderId) => {
  const order = await Order.findById(orderId).populate("restaurantId", "owner").lean();
  const ownerId = order?.restaurantId?.owner;
  if (!ownerId) return null;
  return safelyNotify(io, {
    recipient: ownerId, role: "restaurant_owner", type: "order.new",
    title: "Có đơn hàng mới", body: `Đơn #${String(order._id).slice(-6).toUpperCase()} đang chờ xử lý.`,
    data: { orderId: String(order._id), path: "/orders" }, eventKey: `order:${order._id}:restaurant:new`,
  });
};

export const notifyCustomerOrderStatus = async (io, orderId) => {
  const order = await Order.findById(orderId).select("user orderStatus").lean();
  if (!order?.user) return null;
  const statusText = {
    pending: "Đơn hàng đang chờ nhà hàng xác nhận.",
    preparing: "Nhà hàng đang chuẩn bị đơn hàng của bạn.",
    delivering: "Đơn hàng đang được giao đến bạn.",
    delivered: "Đơn hàng đã được giao thành công.",
    cancelled: "Đơn hàng đã được hủy.",
    refund_pending: "Yêu cầu hoàn tiền của bạn đang chờ xử lý.",
  }[order.orderStatus] || "Trạng thái đơn hàng đã được cập nhật.";
  return safelyNotify(io, {
    recipient: order.user, role: "user", type: "order.status",
    title: order.orderStatus === "preparing" ? "Đơn hàng đang được chuẩn bị"
      : order.orderStatus === "delivered" ? "Đơn hàng đã đến nơi"
        : "Cập nhật đơn hàng",
    body: statusText,
    data: { orderId: String(order._id), path: orderPath(order._id) }, eventKey: `order:${order._id}:status:${order.orderStatus}`,
  });
};

export const notifyCustomerPaymentConfirmed = async (io, orderId) => {
  const order = await Order.findById(orderId).select("user").lean();
  if (!order?.user) return null;
  return safelyNotify(io, {
    recipient: order.user, role: "user", type: "payment.confirmed", title: "Thanh toán thành công",
    body: `Đơn #${String(order._id).slice(-6).toUpperCase()} đã được xác nhận thanh toán.`,
    data: { orderId: String(order._id), path: orderPath(order._id) }, eventKey: `order:${order._id}:payment:confirmed`,
  });
};

export const notifyCustomerShipperAccepted = async (io, orderId) => {
  const order = await Order.findById(orderId).select("user shipperId").lean();
  if (!order?.user || !order.shipperId) return null;
  return safelyNotify(io, {
    recipient: order.user, role: "user", type: "order.shipper_accepted", title: "Tài xế đã nhận đơn",
    body: "Tài xế đã nhận đơn hàng và nhà hàng sẽ bắt đầu chuẩn bị.",
    data: { orderId: String(order._id), path: orderPath(order._id) }, eventKey: `order:${order._id}:shipper:accepted`,
  });
};

export const notifyShippersNewOrder = async (io, orderId, shipperIds) => {
  if (!shipperIds?.length) return [];
  const order = await Order.findById(orderId).select("_id").lean();
  if (!order) return [];
  const shortId = String(order._id).slice(-6).toUpperCase();
  return Promise.all(shipperIds.map((shipperId) => safelyNotify(io, {
    recipient: shipperId,
    role: "shipper",
    type: "order.offer",
    title: "Có đơn hàng mới gần bạn",
    body: `Đơn #${shortId} đang chờ tài xế nhận.`,
    data: { orderId: String(order._id), path: "/offers" },
    eventKey: `order:${order._id}:shipper:offer`,
  })));
};

export const notifyWalletTransaction = async (io, transaction) => {
  if (!transaction?.ownerId || !transaction?._id || !transaction.amount) return null;
  let recipient = transaction.ownerId;
  let role = "shipper";
  if (transaction.ownerType === "restaurant") {
    const restaurant = await Restaurant.findById(transaction.ownerId).select("owner").lean();
    recipient = restaurant?.owner;
    role = "restaurant_owner";
  }
  if (!recipient) return null;
  const increased = transaction.amount > 0;
  return safelyNotify(io, {
    recipient,
    role,
    type: increased ? "wallet.increased" : "wallet.decreased",
    title: increased ? "Số dư ví đã tăng" : "Số dư ví đã giảm",
    body: increased ? "Ví của bạn vừa được ghi có. Mở ứng dụng để xem chi tiết." : "Ví của bạn vừa được ghi giảm. Mở ứng dụng để xem chi tiết.",
    data: { transactionId: String(transaction._id), path: "/wallet" },
    eventKey: `wallet:${transaction._id}`,
  });
};

export const notifyAdmins = async (io, { type, title, body, data, eventKey }) => {
  const admins = await User.find({ role: "admin", locked: false }).select("_id").lean();
  return Promise.all(admins.map((admin) => safelyNotify(io, {
    recipient: admin._id, role: "admin", type, title, body, data, eventKey,
  })));
};

export const notifyRefundDecision = async (io, refund, status) => safelyNotify(io, {
  recipient: refund.customer, role: "user", type: `refund.${status}`,
  title: status === "paid" ? "Hoàn tiền đã hoàn tất" : "Yêu cầu hoàn tiền bị từ chối",
  body: status === "paid" ? "Nhà quản trị đã xác nhận chuyển khoản hoàn tiền." : "Yêu cầu hoàn tiền đã bị từ chối. Bạn có thể xem ghi chú trong chi tiết đơn hàng.",
  data: { orderId: String(refund.order), refundId: String(refund._id), path: orderPath(refund.order) }, eventKey: `refund:${refund._id}:${status}`,
});

export const notifyWithdrawalOwner = async (io, request, status) => {
  let recipient = request.shipper;
  let role = "shipper";
  if (request.actorType === "restaurant") {
    const restaurant = await Restaurant.findById(request.restaurant).select("owner").lean();
    recipient = restaurant?.owner;
    role = "restaurant_owner";
  }
  if (!recipient) return null;
  const content = {
    approved: ["Yêu cầu rút tiền đã được duyệt", "Nhà quản trị đã duyệt yêu cầu rút tiền của bạn."],
    paid: ["Rút tiền đã hoàn tất", "Khoản rút tiền của bạn đã được thanh toán."],
    rejected: ["Yêu cầu rút tiền bị từ chối", "Khoản tiền đã được trả lại số dư khả dụng của bạn."],
  }[status];
  return safelyNotify(io, {
    recipient, role, type: `withdrawal.${status}`, title: content?.[0] || "Cập nhật yêu cầu rút tiền", body: content?.[1] || "Yêu cầu rút tiền đã được cập nhật.",
    data: { withdrawalId: String(request._id), path: role === "restaurant_owner" ? "/wallet" : "/wallet" }, eventKey: `withdrawal:${request._id}:${status}`,
  });
};
