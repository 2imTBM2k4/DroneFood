/**
 * Sends the minimum order payload needed by the customer tracking screen.
 * Keeping this in one place prevents a status update made by a restaurant or
 * a shipper from silently missing the real-time notification.
 */
export const emitCustomerOrderUpdate = async (io, orderId) => {
  if (!io || !orderId) return;

  const { Order } = await import("../models/index.cjs");
  const order = await Order.findById(orderId)
    .select("user orderStatus deliveryMethod cancellationCode reason qrCode qrScanned cargoChecked")
    .lean();

  if (!order?.user) return;
  io.to(`customer_${order.user}`).emit("orderStatusUpdated", {
    orderId: String(order._id),
    orderStatus: order.orderStatus,
    deliveryMethod: order.deliveryMethod,
    cancellationCode: order.cancellationCode,
    reason: order.reason,
    qrCode: order.qrCode,
    qrScanned: order.qrScanned,
    cargoChecked: order.cargoChecked,
  });
};
