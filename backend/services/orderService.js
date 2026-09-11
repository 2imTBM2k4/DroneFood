import mongoose from "mongoose";
import crypto from "crypto";
import * as orderRepo from "../repositories/orderRepository.js";
import * as restaurantRepo from "../repositories/restaurantRepository.js";
import * as userRepo from "../repositories/userRepository.js";
import * as cartRepo from "../repositories/cartRepository.js";
import AppError from "../utils/AppError.js";
import { computeUnitPrice } from "../utils/foodOptions.js";
import { calculateShippingQuote, computeOrderTotals } from "../config/fees.js";
import { recordAudit } from "../utils/auditLog.js";

const VNPAY_DEFAULT_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

const vnpayDate = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).reduce((value, part) =>
    ["year", "month", "day", "hour", "minute", "second"].includes(part.type)
      ? value + part.value : value, "");

const signedVnpayQuery = (params, secret) => {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .sort(([a], [b]) => a.localeCompare(b))
  ).toString();
  return crypto.createHmac("sha512", secret).update(query, "utf8").digest("hex");
};

const vnpayConfig = () => {
  const tmnCode = process.env.VNPAY_TMN_CODE;
  const hashSecret = process.env.VNPAY_HASH_SECRET;
  const returnUrl = process.env.VNPAY_RETURN_URL;
  if (!tmnCode || !hashSecret || !returnUrl) {
    throw new AppError("VNPay is not configured. Set VNPAY_TMN_CODE, VNPAY_HASH_SECRET and VNPAY_RETURN_URL.", 503);
  }
  return { tmnCode, hashSecret, returnUrl, paymentUrl: process.env.VNPAY_PAYMENT_URL || VNPAY_DEFAULT_URL };
};

export const quoteDelivery = async (user, { address, deliveryMethod }) => {
  const cart = await cartRepo.findByUserId(user._id);
  const firstLine = (cart?.items || []).find((line) => line.foodId);
  if (!firstLine?.foodId?.restaurantId) {
    throw new AppError("Cart is empty. Please add items to your cart.", 400);
  }

  const restaurant = await restaurantRepo.findById(firstLine.foodId.restaurantId);
  if (!restaurant) throw new AppError("Restaurant not found.", 404);

  return calculateShippingQuote({
    deliveryMethod,
    origin: { lat: restaurant.lat, lng: restaurant.lng },
    destination: { lat: address.lat, lng: address.lng },
  });
};

export const placeOrder = async (user, orderData, clientIp) => {
  const { address, paymentMethod, deliveryMethod } = orderData;

  if (!address) {
    throw new AppError("Shipping address is required.", 400);
  }

  // The server's cart is the only source of truth for what is being bought
  // and what it costs. Whatever `items`, `amount` or `restaurantId` the client
  // sent is ignored — otherwise a customer could set their own prices.
  const cart = await cartRepo.findByUserId(user._id);
  const cartLines = (cart?.items || []).filter((line) => line.foodId);

  if (cartLines.length === 0) {
    throw new AppError("Cart is empty. Please add items to your cart.", 400);
  }

  const orderItems = cartLines.map((line) => {
    const food = line.foodId;
    const selectedOptions = (line.selectedOptions || []).map((option) => ({
      groupName: option.groupName,
      optionName: option.optionName,
      priceDelta: option.priceDelta || 0,
    }));

    return {
      product: food._id,
      name: food.name,
      quantity: line.quantity,
      price: computeUnitPrice(food, selectedOptions),
      image: food.image,
      selectedOptions,
      note: line.note || "",
    };
  });

  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const restaurantId = cartLines[0].foodId.restaurantId;
  if (!restaurantId) {
    throw new AppError("Restaurant ID is required.", 400);
  }

  // The storefront hides closed restaurants, but a stale tab could still get
  // this far — the order has to be refused here too.
  const restaurant = await restaurantRepo.findById(restaurantId);
  if (!restaurant) {
    throw new AppError("Restaurant not found.", 404);
  }
  if (restaurant.isOpen === false) {
    throw new AppError(
      "This restaurant is currently closed and is not taking orders.",
      409
    );
  }

  const deliveryQuote = await calculateShippingQuote({
    deliveryMethod,
    origin: { lat: restaurant.lat, lng: restaurant.lng },
    destination: { lat: address.lat, lng: address.lng },
  });
  const totals = computeOrderTotals(subtotal, deliveryQuote.shippingPrice);

  const newOrderData = {
    user: user._id,
    orderItems,
    shippingAddress: {
      fullName: address.fullName,
      address: address.address,
      city: address.city,
      state: address.state,
      country: address.country,
      zipCode: address.zipCode,
      phone: address.phone,
      lat: address.lat ?? null,
      lng: address.lng ?? null,
    },
    paymentMethod,
    currency: "VND",
    deliveryMethod: deliveryQuote.deliveryMethod,
    deliveryDistanceKm: deliveryQuote.billedDistanceKm,
    deliveryDistanceType: deliveryQuote.distanceType,
    deliveryRatePerKm: deliveryQuote.ratePerKm,
    ...(deliveryMethod === "shipper" && {
      pickupLocation: {
        type: "Point",
        coordinates: [restaurant.lng, restaurant.lat],
      },
      shipperAssignmentStatus: "unassigned",
      shipperAssignmentDeadlineAt: new Date(Date.now() + 15 * 60 * 1000),
    }),
    itemsPrice: totals.subtotal,
    totalPrice: totals.total,
    shippingPrice: totals.deliveryFee,
    serviceFee: totals.serviceFee,
    restaurantId: restaurantId,
    isPaid: false,
    paidAt: null,
    orderStatus: "pending",
  };
  const newOrder = await orderRepo.create(newOrderData);
  await cartRepo.deleteByUserId(user._id);
  await userRepo.updateById(user._id, { cart: [] });

  let paymentUrl = null;
  if (paymentMethod === "VNPAY") {
    const { tmnCode, hashSecret, returnUrl, paymentUrl: gatewayUrl } = vnpayConfig();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const params = {
      vnp_Amount: String(Math.round(totals.total) * 100),
      vnp_Command: "pay",
      vnp_CreateDate: vnpayDate(now),
      vnp_CurrCode: "VND",
      vnp_ExpireDate: vnpayDate(expiresAt),
      vnp_IpAddr: clientIp || "127.0.0.1",
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toan don hang ${newOrder._id}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl: returnUrl,
      vnp_TmnCode: tmnCode,
      vnp_TxnRef: String(newOrder._id),
      vnp_Version: "2.1.0",
    };
    const secureHash = signedVnpayQuery(params, hashSecret);
    paymentUrl = `${gatewayUrl}?${new URLSearchParams({ ...params, vnp_SecureHash: secureHash }).toString()}`;
    await orderRepo.updateById(newOrder._id, { vnpTxnRef: params.vnp_TxnRef });
  }

  return {
    success: true,
    ...(paymentUrl && { paymentUrl }),
    orderId: newOrder._id,
    restaurantId: restaurantId.toString(),
    deliveryMethod,
    message:
      paymentMethod === "COD"
        ? "Order placed with COD"
        : paymentMethod === "VNPAY"
        ? "Order created. Redirecting to VNPay."
        : "Order created",
  };
};

export const handleVnpayReturn = async (query) => {
  const { hashSecret } = vnpayConfig();
  const receivedHash = query.vnp_SecureHash;
  const signedParams = Object.fromEntries(
    Object.entries(query).filter(([key]) => key !== "vnp_SecureHash" && key !== "vnp_SecureHashType")
  );
  const calculatedHash = signedVnpayQuery(signedParams, hashSecret);
  const hashIsValid = typeof receivedHash === "string" && receivedHash.length === calculatedHash.length &&
    crypto.timingSafeEqual(Buffer.from(receivedHash, "utf8"), Buffer.from(calculatedHash, "utf8"));
  const orderId = query.vnp_TxnRef;
  const order = orderId && await orderRepo.findById(orderId);
  const paid = hashIsValid && order && query.vnp_ResponseCode === "00" &&
    Number(query.vnp_Amount) === Math.round(order.totalPrice) * 100;

  if (paid && !order.isPaid) {
    await orderRepo.updateById(orderId, {
      isPaid: true,
      paidAt: Date.now(),
      vnpTransactionNo: query.vnp_TransactionNo || null,
      paymentResult: { id: query.vnp_TransactionNo, status: query.vnp_ResponseCode, update_time: query.vnp_PayDate },
    });
  }
  if (hashIsValid && order && !paid && !order.isPaid) {
    await orderRepo.updateById(orderId, { orderStatus: "cancelled", reason: "VNPay payment failed or was cancelled" });
  }
  return { orderId, paid: Boolean(paid) };
};

export const verifyOrder = async (user, orderId) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  if (order.user._id.toString() !== user._id.toString()) {
    throw new AppError("Unauthorized: Not your order", 403);
  }

  return { success: order.isPaid, message: order.isPaid ? "Paid" : "Payment has not been confirmed" };
};

export const userOrders = async (userId) => {
  const orders = await orderRepo.findByUser(userId);
  return { success: true, data: orders };
};

export const listOrders = async (user, { page, limit } = {}) => {
  let filter = {};
  if (user.role === "restaurant_owner") {
    let restId = user.restaurantId;
    if (!restId) {
      const restaurant = await restaurantRepo.findByOwner(user._id);
      if (restaurant) {
        restId = restaurant._id;
      }
    }
    filter.restaurantId = restId;
  } else if (user.role !== "admin") {
    throw new AppError("Unauthorized", 403);
  }
  const result = await orderRepo.findAll(filter, { page, limit });
  return { success: true, data: result.data, ...(result.pagination && { pagination: result.pagination }) };
};

export const updateStatus = async (user, updateData) => {
  const { orderId, status, reason, isPaid, paidAt } = updateData;
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (status === "delivering" && order.deliveryMethod === "drone" && !order.droneId) {
    const droneRepo = await import("../repositories/droneRepository.js");
    const crypto = await import("crypto");
    const cargoWeight = Math.floor(Math.random() * 1500) + 500;
    const drone = await droneRepo.claimAvailable(orderId, cargoWeight);

    // No fit drone means the food cannot actually leave. Letting the order slip
    // into "delivering" anyway would strand it: no drone, no QR code, and the
    // customer could never confirm receipt. It stays in "preparing" instead.
    if (!drone) {
      throw new AppError(
        `No drone is available with at least ${droneRepo.MIN_BATTERY_PERCENT}% battery. Please try again once one is free.`,
        409
      );
    }

    const hash = crypto.default.createHash("sha256");
    hash.update(`${orderId}-${Date.now()}-${process.env.JWT_SECRET || "secret"}`);
    const qrCode = hash.digest("hex").substring(0, 16).toUpperCase();

    order.droneId = drone._id;
    order.qrCode = qrCode;
    await order.save();
  }

  // THAY THẾ TOÀN BỘ PHẦN CHECK CHO ROLE "restaurant_owner" (fallback + auto-fix, FIX: dùng order.restaurantId thay vì order.restaurant)
  if (user.role === "restaurant_owner") {
    if (!order.restaurantId) {
      throw new AppError("Unauthorized: Order missing restaurantId", 403);
    }

    // Priority check: user.restaurantId vs order.restaurantId (fast)
    let isAuthorized = false;
    const userRestStr = user.restaurantId ? user.restaurantId.toString() : null;
    const orderRestStr = order.restaurantId._id
      ? order.restaurantId._id.toString()
      : order.restaurantId.toString(); // FIX: Lấy _id từ populated object

    if (userRestStr && userRestStr === orderRestStr) {
      isAuthorized = true;
    } else {
      // Fallback: Check owner từ populated restaurantId (không cần fetch extra, repo đã populate)
      if (order.restaurantId && order.restaurantId.owner) {
        const orderOwnerStr = order.restaurantId.owner._id
          ? order.restaurantId.owner._id.toString()
          : order.restaurantId.owner.toString();

        if (user._id.toString() === orderOwnerStr) {
          isAuthorized = true;
          // Auto-fix user.restaurantId cho lần sau (one-time, chỉ nếu null/mismatch)
          if (
            !user.restaurantId ||
            user.restaurantId.toString() !== order.restaurantId._id.toString()
          ) {
            await userRepo.updateById(user._id, {
              restaurantId: order.restaurantId._id,
            });
            user.restaurantId = order.restaurantId._id.toString(); // Update in-memory
          }
        }
      } else {
        // Nếu chưa populate owner, fetch manual (fallback cuối)
        const fullRestaurant = await restaurantRepo.findById(
          order.restaurantId
        );
        if (fullRestaurant && fullRestaurant.owner) {
          const orderOwnerStr = fullRestaurant.owner._id
            ? fullRestaurant.owner._id.toString()
            : fullRestaurant.owner.toString();

          if (user._id.toString() === orderOwnerStr) {
            isAuthorized = true;
            if (
              !user.restaurantId ||
              user.restaurantId.toString() !== order.restaurantId.toString()
            ) {
              await userRepo.updateById(user._id, {
                restaurantId: order.restaurantId,
              });
              user.restaurantId = order.restaurantId.toString(); // Update in-memory
            }
          }
        }
      }
    }

    if (!isAuthorized) {
      throw new AppError("Unauthorized: Not your restaurant", 403);
    }

    // Validation rules từ gốc (status transitions)
    if (order.orderStatus !== "pending" && status === "preparing") {
      throw new AppError("Cannot accept (not pending)", 400);
    }
    if (order.orderStatus !== "preparing" && status === "delivering") {
      throw new AppError("Cannot handover (not preparing)", 400);
    }
    if (order.deliveryMethod === "shipper" && status === "delivering") {
      throw new AppError("A shipper delivery can only be marked picked up by its assigned shipper", 403);
    }
    if (status === "cancelled" && (!reason || reason.trim() === "")) {
      throw new AppError("Reason required for cancellation", 400);
    }
  } else if (user.role === "user") {
    if (order.user._id.toString() !== user._id.toString()) {
      throw new AppError("Unauthorized: Not your order", 403);
    }

    if (status === "delivered") {
      if (order.orderStatus !== "delivering") {
        throw new AppError("Cannot mark received yet (not delivering)", 400);
      }
    } else if (status === "cancelled") {
      if (order.orderStatus !== "pending") {
        throw new AppError("Chỉ có thể hủy đơn hàng khi đang chờ xác nhận", 400);
      }
      if (!reason || reason.trim() === "") {
        throw new AppError("Reason required for cancellation", 400);
      }
    } else {
      throw new AppError("Only delivered or cancelled status allowed for users", 400);
    }
  } else if (user.role === "shipper") {
    if (status !== "delivered" || order.deliveryMethod !== "shipper") {
      throw new AppError("Shippers can only complete their assigned shipper delivery", 403);
    }
    if (String(order.shipperId) !== String(user._id)) {
      throw new AppError("Unauthorized: Not your delivery", 403);
    }
    if (order.orderStatus !== "delivering") {
      throw new AppError("Cannot complete before pickup", 400);
    }
  } else if (user.role === "admin") {
    // An admin can override any transition — that is what a support console is
    // for — but never silently. A reason is mandatory and the override is
    // written to the audit trail once it succeeds.
    if (!reason || reason.trim() === "") {
      throw new AppError(
        "A reason is required when an admin changes an order's status.",
        400
      );
    }
  } else {
    throw new AppError("Unauthorized: Invalid role", 403);
  }

  const previousStatus = order.orderStatus;
  const updateDataObj = { orderStatus: status };
  if (status === "cancelled" && reason) {
    updateDataObj.reason = reason.trim();
    
    // Giải phóng drone khi đơn hàng bị hủy
    if (order.droneId) {
      const droneRepo = await import("../repositories/droneRepository.js");
      const drone = await droneRepo.findById(order.droneId);
      if (drone) {
        drone.status = "available";
        drone.currentOrder = null;
        drone.cargoWeight = 0;
        drone.cargoLidStatus = "closed";
        await drone.save();
      }
    }
  }

  if (status === "delivered") {
    updateDataObj.isDelivered = true;
    updateDataObj.deliveredAt = Date.now();
    if (order.deliveryMethod === "shipper") {
      updateDataObj.shipperAssignmentStatus = "completed";
      updateDataObj.shipperCompletedAt = Date.now();
    }

    if (isPaid === true) {
      updateDataObj.isPaid = true;
      updateDataObj.paidAt = paidAt || Date.now();
    } else if (order.paymentMethod === "COD") {
      updateDataObj.isPaid = true;
      updateDataObj.paidAt = Date.now();
    }

    // Cập nhật drone về trạng thái available
    if (order.droneId) {
      const droneRepo = await import("../repositories/droneRepository.js");
      const drone = await droneRepo.findById(order.droneId);
      if (drone) {
        drone.status = "available";
        drone.currentOrder = null;
        drone.cargoWeight = 0;
        drone.cargoLidStatus = "closed";
        drone.totalDeliveries += 1;
        await drone.save();
      }
    }

    if (!order.isDelivered && (updateDataObj.isPaid || order.isPaid)) {
      const restaurant = await restaurantRepo.findById(order.restaurantId);
      const admin = await userRepo.findAdmin();
      if (!admin) {
        throw new AppError("Admin account not found. Cannot process balance update.", 500);
      }
      if (restaurant && admin) {
        // Split the FOOD subtotal only — the delivery and service fees are the
        // platform's, so paying the restaurant a cut of them would overpay it.
        // Older orders predate `itemsPrice`, so fall back to the item snapshot.
        const itemsSubtotal =
          typeof order.itemsPrice === "number" && order.itemsPrice > 0
            ? order.itemsPrice
            : (order.orderItems || []).reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
              );
        const platformFees =
          (order.shippingPrice || 0) + (order.serviceFee || 0);

        const restaurantShare = itemsSubtotal * 0.8;
        const adminShare = itemsSubtotal * 0.2 + platformFees;

        try {
          const session = await mongoose.startSession();
          try {
            await session.withTransaction(async () => {
              await restaurantRepo.updateById(
                restaurant._id,
                { $inc: { balance: restaurantShare } },
                { session }
              );
              await userRepo.updateById(
                admin._id,
                { $inc: { balance: adminShare } },
                undefined,
                { session }
              );
            });
          } finally {
            await session.endSession();
          }
        } catch (txnError) {
          if (
            txnError.message?.includes("Transaction") ||
            txnError.message?.includes("replica set") ||
            txnError.codeName === "IllegalOperation"
          ) {
            await Promise.all([
              restaurantRepo.updateById(restaurant._id, {
                $inc: { balance: restaurantShare },
              }),
              userRepo.updateById(admin._id, {
                $inc: { balance: adminShare },
              }),
            ]);
          } else {
            throw txnError;
          }
        }
      }
    }
  }

  await orderRepo.updateById(orderId, updateDataObj);
  // Every status change is recorded, whoever made it. Admin overrides carry the
  // mandatory reason; the customer's and restaurant's own actions are logged
  // too so the order's history is complete.
  await recordAudit({
    actor: user,
    action:
      user.role === "admin"
        ? "order.status_overridden_by_admin"
        : "order.status_changed",
    targetType: "order",
    targetId: orderId,
    reason: reason || "",
    metadata: { from: previousStatus, to: status },
  });

  return { success: true, message: "Status Updated" };
};

export const getStatusStats = async () => {
  const stats = await orderRepo.aggregateStatusStats();
  if (!stats.length) {
    return {
      success: true,
      data: [
        { name: "Pending", value: 0 },
        { name: "Preparing", value: 0 },
        { name: "Delivering", value: 0 },
        { name: "Delivered", value: 0 },
        { name: "Cancelled", value: 0 },
      ],
    };
  }
  return { success: true, data: stats };
};
