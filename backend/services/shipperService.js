import { Order, ShipperProfile } from "../models/index.cjs";
import axios from "axios";
import crypto from "crypto";
import AppError from "../utils/AppError.js";
import { recordAudit } from "../utils/auditLog.js";
import * as orderService from "./orderService.js";
import { getShipperWalletSummary, requireShipperCanAcceptOrders, reserveCodLiability } from "./walletService.js";
import { fetchLiveShipperRoute, shouldRefreshLiveRoute } from "./shipperRouteService.js";
import { requireShipperWithinMetres } from "./shipperLocationVerificationService.js";
import { isZeroPayableVoucherOrder } from "../utils/zeroPayableVoucher.js";
import { logger } from "../utils/logger.js";

const LOCATION_STALE_MS = 90 * 1000;
const OFFER_RADIUS_METRES = 5000;
export const SHIPPER_ASSIGNMENT_WINDOW_MS = 10 * 60 * 1000;
const DISPATCHABLE_ORDER_STATUSES = ["pending", "preparing"];

const getProfile = async (userId) => {
  const profile = await ShipperProfile.findOne({ user: userId });
  // Older registrations could create the user before MongoDB rejected an
  // empty GeoJSON point. Recover that orphaned account on its first Shipper
  // request so an admin can approve it normally.
  return profile || ShipperProfile.create({ user: userId, vehicleType: "motorbike" });
};

const requireApproved = (profile) => {
  if (profile.approvalStatus !== "approved") {
    throw new AppError("Shipper profile is pending approval", 403);
  }
};

const activeTrackingOrderFor = (shipperId, orderId) => Order.findOne({
  _id: orderId,
  shipperId,
  deliveryMethod: "shipper",
  $or: [
    { orderStatus: "delivering", shipperAssignmentStatus: "picked_up" },
    { orderStatus: "arrived_at_delivery", shipperAssignmentStatus: "arrived" },
  ],
}).select("_id orderStatus shipperAssignmentStatus shippingAddress liveShipperRoute");

const hasCoordinates = (point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng) &&
  Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;

const requireFreshLocation = (profile) => {
  const fresh = profile.locationUpdatedAt && Date.now() - profile.locationUpdatedAt.getTime() <= LOCATION_STALE_MS;
  if (!fresh || !Array.isArray(profile.currentLocation?.coordinates) || profile.currentLocation.coordinates.length !== 2) {
    throw new AppError("A live location updated within 90 seconds is required", 409);
  }
};

export const me = async (userId) => ({
  success: true,
  data: await getProfile(userId),
  wallet: await getShipperWalletSummary(userId),
});

export const updateLocation = async (userId, { lat, lng, pushToken }) => {
  const profile = await getProfile(userId);
  requireApproved(profile);
  if (profile.status === "offline") throw new AppError("Set status to available before sharing location", 409);

  const now = new Date();
  const updated = await ShipperProfile.findOneAndUpdate(
    { _id: profile._id },
    {
      $set: {
        currentLocation: { type: "Point", coordinates: [lng, lat] },
        locationUpdatedAt: now,
        ...(pushToken !== undefined && { pushToken: pushToken || "" }),
      },
    },
    { new: true, runValidators: true }
  );

  let trackingOrder = null;
  if (updated?.currentOrder) {
    const activeOrder = await activeTrackingOrderFor(userId, updated.currentOrder);
    const origin = { lat, lng };
    const destination = activeOrder?.shippingAddress;
    if (activeOrder && hasCoordinates(origin) && hasCoordinates(destination)) {
      trackingOrder = activeOrder;
      if (activeOrder.orderStatus === "delivering" && activeOrder.shipperAssignmentStatus === "picked_up" && shouldRefreshLiveRoute(activeOrder.liveShipperRoute, origin, now)) {
        try {
          const liveShipperRoute = await fetchLiveShipperRoute({
            origin,
            destination,
            now,
            onFailure: ({ category, httpStatus }) => logger.warn({
              orderId: String(activeOrder._id),
              category,
              ...(httpStatus && { httpStatus }),
            }, "Live shipper route refresh failed"),
          });
          trackingOrder = await Order.findByIdAndUpdate(
            activeOrder._id,
            { $set: { liveShipperRoute, liveShipperRouteStatus: "available" } },
            { new: true }
          ).select("_id shippingAddress liveShipperRoute liveShipperRouteStatus");
        } catch {
          // GPS delivery remains available if the external routing provider is
          // temporarily unavailable. Only a sanitized state is persisted; the
          // provider key, coordinates, and raw error never reach the customer.
          await Order.updateOne(
            { _id: activeOrder._id },
            { $set: { liveShipperRouteStatus: "unavailable" } }
          );
        }
      }
    }
  }

  return { success: true, data: updated, trackingOrder };
};

export const updateStatus = async (userId, status) => {
  const profile = await getProfile(userId);
  requireApproved(profile);
  if (profile.currentOrder && status === "offline") {
    throw new AppError("Cannot go offline while an order is assigned", 409);
  }
  const updated = await ShipperProfile.findByIdAndUpdate(
    profile._id,
    { $set: { status } },
    { new: true, runValidators: true }
  );
  return { success: true, data: updated };
};

export const availableOrders = async (userId) => {
  const profile = await getProfile(userId);
  requireApproved(profile);
  requireFreshLocation(profile);
  if (profile.status !== "available") return { success: true, data: [] };
  const wallet = await getShipperWalletSummary(userId);
  if (wallet.isAcceptanceLocked) return { success: true, data: [], wallet };

  const now = new Date();
  const orders = await Order.find({
    deliveryMethod: "shipper",
    shipperAssignmentStatus: "unassigned",
    orderStatus: { $in: DISPATCHABLE_ORDER_STATUSES },
    shipperAssignmentDeadlineAt: { $gt: now },
    pickupLocation: {
      $near: {
        $geometry: profile.currentLocation,
        $maxDistance: OFFER_RADIUS_METRES,
      },
    },
  }).populate("restaurantId", "name address phone");
  const eligibleOrders = orders.filter((order) => {
    if (order.paymentMethod !== "COD") return true;
    const liability = order.financialSnapshot?.codLiabilityAmount || Math.round(
      (order.itemsPrice || 0) + (order.shippingPrice || 0) * 0.15
    );
    return wallet.reservedCodLiability + liability <= wallet.depositBalance + wallet.earningsAvailable &&
      wallet.earningsAvailable - wallet.reservedCodLiability - liability > wallet.lockThreshold;
  });
  return { success: true, data: eligibleOrders, wallet };
};

export const currentOrder = async (userId) => {
  const profile = await getProfile(userId);
  if (!profile.currentOrder) return { success: true, data: null };

  const order = await Order.findById(profile.currentOrder)
    .populate("restaurantId", "name address phone lat lng")
    .populate("user", "name phone")
    .lean();

  return { success: true, data: order || null };
};

export const nearbyAvailableShipperIds = async (pickupLocation) => {
  if (!pickupLocation?.coordinates) return [];
  const freshAfter = new Date(Date.now() - LOCATION_STALE_MS);
  const profiles = await ShipperProfile.find({
    status: "available",
    approvalStatus: "approved",
    locationUpdatedAt: { $gte: freshAfter },
    currentLocation: { $near: { $geometry: pickupLocation, $maxDistance: OFFER_RADIUS_METRES } },
  }).limit(10).select("user");
  return profiles.map((profile) => String(profile.user));
};

export const acceptOrder = async (user, orderId) => {
  const profile = await getProfile(user._id);
  requireApproved(profile);
  requireFreshLocation(profile);
  await requireShipperCanAcceptOrders(user._id);
  if (profile.status !== "available" || profile.currentOrder) {
    throw new AppError("Shipper is not available", 409);
  }

  const claimedProfile = await ShipperProfile.findOneAndUpdate(
    { _id: profile._id, status: "available", currentOrder: null },
    { $set: { status: "assigned", currentOrder: orderId } },
    { new: true }
  );
  if (!claimedProfile) throw new AppError("Shipper is no longer available", 409);

  const now = new Date();
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      deliveryMethod: "shipper",
      shipperAssignmentStatus: "unassigned",
      orderStatus: { $in: DISPATCHABLE_ORDER_STATUSES },
      shipperAssignmentDeadlineAt: { $gt: now },
    },
    {
      $set: {
        shipperId: user._id,
        shipperAssignmentStatus: "accepted",
        shipperAcceptedAt: now,
      },
    },
    { new: true }
  );

  if (!order) {
    await ShipperProfile.findByIdAndUpdate(profile._id, { $set: { status: "available", currentOrder: null } });
    throw new AppError("Order is no longer available", 409);
  }
  if (order.paymentMethod === "COD") {
    try {
      await reserveCodLiability(order._id, user._id);
    } catch (error) {
      await Promise.all([
        Order.updateOne(
          { _id: order._id, shipperId: user._id, shipperAssignmentStatus: "accepted" },
          { $set: { shipperId: null, shipperAssignmentStatus: "unassigned", shipperAcceptedAt: null } }
        ),
        ShipperProfile.findByIdAndUpdate(profile._id, { $set: { status: "available", currentOrder: null } }),
      ]);
      throw error;
    }
  }
  await recordAudit({ actor: user, action: "shipper.order_accepted", targetType: "order", targetId: order._id });
  return { success: true, data: order };
};

export const pickupOrder = async (user, orderId) => {
  const profile = await getProfile(user._id);
  requireApproved(profile);
  const readyOrder = await Order.findOne({
    _id: orderId,
    deliveryMethod: "shipper",
    shipperId: user._id,
    shipperAssignmentStatus: "accepted",
    orderStatus: "preparing",
  }).populate("restaurantId", "lat lng");
  if (!readyOrder) throw new AppError("Order is not ready for pickup", 409);

  requireShipperWithinMetres({
    profile,
    target: { lat: readyOrder.restaurantId?.lat, lng: readyOrder.restaurantId?.lng },
    message: "Vị trí của bạn chưa gần quán. Hãy đến trong phạm vi 200 m để xác nhận lấy hàng.",
  });

  const now = new Date();
  const order = await Order.findOneAndUpdate(
    {
      _id: readyOrder._id,
      deliveryMethod: "shipper",
      shipperId: user._id,
      shipperAssignmentStatus: "accepted",
      orderStatus: "preparing",
    },
    { $set: { orderStatus: "delivering", shipperAssignmentStatus: "picked_up", shipperPickedUpAt: now } },
    { new: true }
  );
  if (!order) throw new AppError("Order is not ready for pickup", 409);
  await ShipperProfile.findOneAndUpdate({ user: user._id, currentOrder: order._id }, { $set: { status: "delivering" } });
  await recordAudit({ actor: user, action: "shipper.order_picked_up", targetType: "order", targetId: order._id });
  return { success: true, data: order };
};

export const arriveAtDelivery = async (user, orderId) => {
  const profile = await getProfile(user._id);
  requireApproved(profile);
  const activeOrder = await Order.findOne({
    _id: orderId,
    deliveryMethod: "shipper",
    shipperId: user._id,
    shipperAssignmentStatus: "picked_up",
    orderStatus: "delivering",
  }).select("shippingAddress");
  if (!activeOrder) throw new AppError("Order is not being delivered by this shipper", 409);

  requireShipperWithinMetres({
    profile,
    target: { lat: activeOrder.shippingAddress?.lat, lng: activeOrder.shippingAddress?.lng },
    message: "Vị trí của bạn chưa gần điểm giao. Hãy đến trong phạm vi 200 m để xác nhận đã tới điểm giao.",
  });

  const now = new Date();
  const order = await Order.findOneAndUpdate(
    {
      _id: activeOrder._id,
      deliveryMethod: "shipper",
      shipperId: user._id,
      shipperAssignmentStatus: "picked_up",
      orderStatus: "delivering",
    },
    { $set: { orderStatus: "arrived_at_delivery", shipperAssignmentStatus: "arrived", shipperArrivedAt: now } },
    { new: true }
  );
  if (!order) throw new AppError("Order is not being delivered by this shipper", 409);
  await recordAudit({ actor: user, action: "shipper.order_arrived_at_delivery", targetType: "order", targetId: order._id });
  return { success: true, data: order };
};

export const completeOrder = async (user, orderId) => {
  const result = await orderService.updateStatus(user, { orderId, status: "delivered" });
  await Order.updateOne({ _id: orderId }, { $unset: { liveShipperRoute: 1 } });
  await ShipperProfile.findOneAndUpdate({ user: user._id, currentOrder: orderId }, { $set: { status: "available", currentOrder: null } });
  await recordAudit({ actor: user, action: "shipper.order_completed", targetType: "order", targetId: orderId });
  return result;
};

export const declineOrder = async (user, orderId, reason = "") => {
  const profile = await getProfile(user._id);
  requireApproved(profile);
  await recordAudit({ actor: user, action: "shipper.order_declined", targetType: "order", targetId: orderId, reason });
  return { success: true };
};

/** Reopens a timed-out paid online order when its customer opts to keep waiting. */
export const extendSearch = async (customer, orderId) => {
  const now = new Date();
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      user: customer._id,
      deliveryMethod: "shipper",
      paymentMethod: "PAYOS",
      isPaid: true,
      orderStatus: { $in: ["pending", "preparing"] },
      shipperAssignmentStatus: "expired",
    },
    {
      $set: {
        orderStatus: "pending",
        shipperAssignmentStatus: "unassigned",
        shipperAssignmentDeadlineAt: new Date(now.getTime() + SHIPPER_ASSIGNMENT_WINDOW_MS),
        cancellationCode: "",
        reason: "",
      },
    },
    { new: true }
  );
  if (!order) {
    throw new AppError("Only a paid online shipper order waiting for your decision can continue searching", 409);
  }
  await recordAudit({ actor: customer, action: "shipper_search_extended", targetType: "order", targetId: order._id });
  return { success: true, data: order };
};

export const approveProfile = async (actor, userId, approvalStatus) => {
  const profile = await ShipperProfile.findOneAndUpdate(
    { user: userId },
    { $set: { approvalStatus, ...(approvalStatus === "rejected" && { status: "offline" }) } },
    { new: true }
  );
  if (!profile) throw new AppError("Shipper profile not found", 404);
  await recordAudit({
    actor,
    action: approvalStatus === "approved" ? "shipper.approved" : "shipper.rejected",
    targetType: "user",
    targetId: userId,
  });
  return { success: true, data: profile };
};

export const listProfiles = async () => ({
  success: true,
  data: await ShipperProfile.find({})
    .populate("user", "name email phone locked")
    .populate("currentOrder", "orderStatus totalPrice shippingAddress")
    .sort({ updatedAt: -1 }),
});

const vnpayDate = (date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
};

export const requestVnpayRefund = async (order) => {
  const tmnCode = process.env.VNPAY_TMN_CODE;
  const hashSecret = process.env.VNPAY_HASH_SECRET;
  const createBy = process.env.VNPAY_REFUND_CREATE_BY;
  if (!tmnCode || !hashSecret || !createBy || !order.vnpTransactionNo) {
    throw new Error("VNPay refund is not configured or the original transaction is missing");
  }
  const requestId = `RF${Date.now()}${String(order._id).slice(-8)}`;
  const createDate = vnpayDate(new Date());
  const transactionDate = order.vnpCreateDate || vnpayDate(order.createdAt);
  const ipAddr = process.env.VNPAY_REFUND_IP_ADDR || "127.0.0.1";
  const orderInfo = `Hoan tien don hang ${order._id}`;
  const data = [requestId, "2.1.0", "refund", tmnCode, "02", order.vnpTxnRef,
    Math.round(order.totalPrice) * 100, order.vnpTransactionNo, transactionDate,
    createBy, createDate, ipAddr, orderInfo].join("|");
  const vnp_SecureHash = crypto.createHmac("sha512", hashSecret).update(data, "utf8").digest("hex");
  const response = await axios.post(
    process.env.VNPAY_REFUND_API_URL || "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    {
      vnp_RequestId: requestId, vnp_Version: "2.1.0", vnp_Command: "refund", vnp_TmnCode: tmnCode,
      vnp_TransactionType: "02", vnp_TxnRef: order.vnpTxnRef,
      vnp_Amount: Math.round(order.totalPrice) * 100, vnp_OrderInfo: orderInfo,
      vnp_TransactionNo: order.vnpTransactionNo, vnp_TransactionDate: transactionDate,
      vnp_CreateBy: createBy, vnp_CreateDate: createDate, vnp_IpAddr: ipAddr, vnp_SecureHash,
    },
    { timeout: 15000 }
  );
  if (response.data?.vnp_ResponseCode !== "00") {
    throw new Error(`VNPay refund rejected: ${response.data?.vnp_Message || response.data?.vnp_ResponseCode || "unknown error"}`);
  }
  return requestId;
};

/**
 * Older shipper orders predate assignment fields. Normalize only records that
 * are demonstrably part of the no-shipper flow, then let the normal expiry
 * path expose the customer's current choices.
 */
const normalizeLegacyShipperTimeouts = async () => {
  const overdueAt = new Date(Date.now() - 1);
  await Order.updateMany(
    {
      deliveryMethod: "shipper",
      paymentMethod: "PAYOS",
      isPaid: true,
      orderStatus: { $in: ["pending", "preparing"] },
      shipperId: null,
      $or: [
        { shipperAssignmentStatus: { $in: ["not_applicable", null] } },
        { shipperAssignmentDeadlineAt: null },
      ],
    },
    {
      $set: {
        orderStatus: "pending",
        shipperAssignmentStatus: "unassigned",
        shipperAssignmentDeadlineAt: overdueAt,
      },
    }
  );
  await Order.updateMany(
    {
      deliveryMethod: "shipper",
      paymentMethod: "PAYOS",
      isPaid: true,
      orderStatus: "cancelled",
      cancellationCode: { $in: ["", null] },
      reason: { $regex: "no shipper accepted", $options: "i" },
    },
    { $set: { cancellationCode: "NO_SHIPPER_AVAILABLE", shipperAssignmentStatus: "expired" } }
  );
};

export const expireUnacceptedOrders = async () => {
  await normalizeLegacyShipperTimeouts();
  const now = new Date();
  const overdueOrders = await Order.find({
    deliveryMethod: "shipper", shipperAssignmentStatus: "unassigned",
    orderStatus: { $in: DISPATCHABLE_ORDER_STATUSES }, shipperAssignmentDeadlineAt: { $lte: now },
  });
  let cancelledCount = 0;
  for (const order of overdueOrders) {
    try {
      // A paid PayOS order must never be silently cancelled without returning
      // the customer's money. It is held for support/manual refund until the
      // PayOS payout workflow is configured.
      if (order.paymentMethod === "PAYOS" && order.isPaid) {
        const zeroPayableVoucherOrder = isZeroPayableVoucherOrder(order);
        const result = await Order.updateOne(
          { _id: order._id, shipperAssignmentStatus: "unassigned", orderStatus: { $in: DISPATCHABLE_ORDER_STATUSES } },
          { $set: {
            shipperAssignmentStatus: "expired",
            cancellationCode: "NO_SHIPPER_AVAILABLE",
            reason: zeroPayableVoucherOrder
              ? "No shipper accepted this voucher-settled order within 10 minutes. The customer can continue searching or cancel the order; there is no PayOS payment to refund."
              : "No shipper accepted this paid online order within 10 minutes. The customer can continue searching or request a manual refund.",
          } }
        );
        cancelledCount += result.modifiedCount;
        continue;
      }
      let refund = {};
      if (order.paymentMethod === "VNPAY" && order.isPaid) {
        const refundRequestId = await requestVnpayRefund(order);
        refund = { refundStatus: "requested", refundRequestId, refundRequestedAt: new Date() };
      }
      const result = await Order.updateOne(
        { _id: order._id, shipperAssignmentStatus: "unassigned", orderStatus: { $in: DISPATCHABLE_ORDER_STATUSES } },
        { $set: { orderStatus: "cancelled", shipperAssignmentStatus: "expired", cancellationCode: "NO_SHIPPER_AVAILABLE", reason: "No shipper accepted this order within 15 minutes.", ...refund } }
      );
      cancelledCount += result.modifiedCount;
    } catch (error) {
      await Order.updateOne({ _id: order._id }, { $set: { refundStatus: "failed" } });
      console.error(`Could not expire order ${order._id}: ${error.message}`);
    }
  }
  return { cancelledCount };
};

export const startShipperExpiryScheduler = () => {
  const run = () => expireUnacceptedOrders().catch((error) => console.error("Shipper expiry job failed:", error.message));
  run();
  return setInterval(run, 60 * 1000);
};

export const orderHistory = async (userId) => {
  const profile = await ShipperProfile.findOne({ user: userId });
  const shipperIds = [userId];
  if (profile?._id) shipperIds.push(profile._id);

  const orders = await Order.find({
    shipperId: { $in: shipperIds },
    orderStatus: "delivered",
  })
    .sort({ deliveredAt: -1, updatedAt: -1, createdAt: -1 })
    .populate("restaurantId", "name address phone lat lng")
    .populate("user", "name phone")
    .lean();

  return { success: true, data: orders || [] };
};

export { LOCATION_STALE_MS, OFFER_RADIUS_METRES };

