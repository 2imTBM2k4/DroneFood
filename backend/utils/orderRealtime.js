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

/**
 * Emits an exact GPS point only to the customer who owns the shipper order
 * currently being delivered. Location updates are intentionally not broadcast
 * to a generic shipper room or exposed through a shipper profile endpoint.
 */
export const serialiseLiveShipperRoute = (route) => {
  const origin = route?.origin;
  const geometry = route?.geometry;
  const generatedAt = new Date(route?.generatedAt);
  if (
    !Number.isFinite(origin?.lat) || !Number.isFinite(origin?.lng) ||
    !Array.isArray(geometry) || geometry.length < 2 ||
    !geometry.every(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng)) ||
    !Number.isFinite(route?.durationSeconds) || route.durationSeconds < 0 ||
    !Number.isFinite(generatedAt.getTime())
  ) return null;

  return {
    origin: { lat: origin.lat, lng: origin.lng },
    geometry: geometry.map(([lng, lat]) => [lng, lat]),
    durationSeconds: route.durationSeconds,
    generatedAt: generatedAt.toISOString(),
  };
};

export const isCustomerTrackableShipperOrder = (order) => (
  order?.deliveryMethod === "shipper" &&
  ((order.orderStatus === "delivering" && order.shipperAssignmentStatus === "picked_up") ||
    (order.orderStatus === "arrived_at_delivery" && order.shipperAssignmentStatus === "arrived"))
);

export const emitCustomerShipperLocation = async (io, shipperId, profile) => {
  const coordinates = profile?.currentLocation?.coordinates;
  if (!io || !shipperId || !profile?.currentOrder || !Array.isArray(coordinates) || coordinates.length !== 2) return;

  const [lng, lat] = coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const { Order } = await import("../models/index.cjs");
  const order = await Order.findOne({
    _id: profile.currentOrder,
    shipperId,
    deliveryMethod: "shipper",
  }).select("user deliveryMethod orderStatus shipperAssignmentStatus liveShipperRoute").lean();

  if (!order?.user || !isCustomerTrackableShipperOrder(order)) return;
  const route = serialiseLiveShipperRoute(order.liveShipperRoute);
  io.to(`customer_${order.user}`).emit("shipperLocationUpdated", {
    orderId: String(profile.currentOrder),
    location: { lat, lng },
    updatedAt: profile.locationUpdatedAt?.toISOString?.() || new Date().toISOString(),
    ...(route && { route }),
  });
};
