import crypto from "crypto";
import mongoose from "mongoose";
import { PayOS } from "@payos/node";
import * as orderRepo from "../repositories/orderRepository.js";
import * as restaurantRepo from "../repositories/restaurantRepository.js";
import * as userRepo from "../repositories/userRepository.js";
import * as cartRepo from "../repositories/cartRepository.js";
import AppError from "../utils/AppError.js";
import { computeUnitPrice } from "../utils/foodOptions.js";
import { calculateShippingQuote, computeOrderTotals } from "../config/fees.js";
import { recordAudit } from "../utils/auditLog.js";
import { releaseCodLiability, settleDeliveredOrder } from "./walletService.js";
import * as voucherService from "./voucherService.js";
import * as voucherRepo from "../repositories/voucherRepository.js";
import { resolveAddressSnapshot } from "./addressBookService.js";
import { attachReviewFlows } from "./orderReviewService.js";

const VNPAY_DEFAULT_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const SHIPPER_ASSIGNMENT_WINDOW_MS = 10 * 60 * 1000;

const vnpayDate = (date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  // VNPay requires yyyyMMddHHmmss, regardless of the display locale's date order.
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
};

const vnpayIpAddress = (ip) => {
  const normalized = String(ip || "127.0.0.1").replace(/^::ffff:/, "");
  return normalized === "::1" ? "127.0.0.1" : normalized;
};

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

const payosConfig = () => {
  const { PAYOS_CLIENT_ID: clientId, PAYOS_API_KEY: apiKey, PAYOS_CHECKSUM_KEY: checksumKey } = process.env;
  if (!clientId || !apiKey || !checksumKey) {
    throw new AppError("PayOS is not configured. Set PAYOS_CLIENT_ID, PAYOS_API_KEY and PAYOS_CHECKSUM_KEY.", 503);
  }
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const returnUrl = process.env.PAYOS_RETURN_URL || `${frontendUrl}/verify`;
  const cancelUrl = process.env.PAYOS_CANCEL_URL || returnUrl;
  try {
    // Fail early with a clear error instead of creating an unreachable link.
    new URL(returnUrl);
    new URL(cancelUrl);
  } catch {
    throw new AppError("PAYOS_RETURN_URL and PAYOS_CANCEL_URL must be absolute URLs.", 503);
  }
  return { payOS: new PayOS({ clientId, apiKey, checksumKey }), returnUrl, cancelUrl };
};

const withOrderId = (url, orderId) => {
  const redirect = new URL(url);
  redirect.searchParams.set("orderId", String(orderId));
  return redirect.toString();
};

const isOnlinePayment = (paymentMethod) => ["VNPAY", "PAYOS"].includes(paymentMethod);

// Bank transfer descriptions need to remain compact. DDMMYY is the Vietnam
// payment date while the final six Mongo id characters remain the human-facing
// order reference shown throughout the app.
const paymentDate = (date = new Date()) => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "2-digit",
}).format(date).replace(/\//g, "");

const orderPaymentDescription = (orderId, date = new Date()) =>
  `DroneFood DH${String(orderId).slice(-6).toUpperCase()} ${paymentDate(date)}`;

// PayOS requires a numeric merchant order code. The timestamp plus random
// suffix stays below JavaScript's safe-integer limit and avoids collisions.
const newPayosOrderCode = () => Number(`${Math.floor(Date.now() / 1000)}${crypto.randomInt(10000, 100000)}1`);

const resolveShippingAddress = async (userId, { address, addressEntryId }) => {
  if (addressEntryId) return resolveAddressSnapshot(userId, addressEntryId);
  if (address) return { ...address };
  throw new AppError("Shipping address is required.", 400);
};

export const quoteDelivery = async (user, { address, addressEntryId, deliveryMethod, voucherCode }) => {
  const shippingAddress = await resolveShippingAddress(user._id, { address, addressEntryId });
  const cart = await cartRepo.findByUserId(user._id);
  const firstLine = (cart?.items || []).find((line) => line.foodId);
  if (!firstLine?.foodId?.restaurantId) {
    throw new AppError("Cart is empty. Please add items to your cart.", 400);
  }

  const restaurant = await restaurantRepo.findById(firstLine.foodId.restaurantId);
  if (!restaurant) throw new AppError("Restaurant not found.", 404);

  const deliveryQuote = await calculateShippingQuote({
    deliveryMethod,
    origin: { lat: restaurant.lat, lng: restaurant.lng },
    destination: { lat: shippingAddress.lat, lng: shippingAddress.lng },
  });
  if (!voucherCode) return deliveryQuote;

  const itemsPrice = (cart.items || []).reduce((sum, line) => {
    const food = line.foodId;
    return sum + (food ? computeUnitPrice(food, line.selectedOptions || []) * line.quantity : 0);
  }, 0);
  const totals = computeOrderTotals(itemsPrice, deliveryQuote.shippingPrice);
  const voucherApplication = await voucherService.validateVoucherForOrder({
    code: voucherCode,
    userId: user._id,
    itemsPrice: totals.subtotal,
    shippingPrice: totals.deliveryFee,
  });
  return {
    ...deliveryQuote,
    itemsPrice: totals.subtotal,
    serviceFee: totals.serviceFee,
    discountAmount: voucherApplication.discountAmount,
    voucher: voucherApplication.snapshot,
    totalPrice: totals.total - voucherApplication.discountAmount,
  };
};

export const placeOrder = async (user, orderData, clientIp) => {
  const { address, addressEntryId, paymentMethod, deliveryMethod, voucherCode } = orderData;
  const shippingAddress = await resolveShippingAddress(user._id, { address, addressEntryId });
  if (paymentMethod === "COD" && deliveryMethod !== "shipper") {
    throw new AppError("COD is only available for shipper delivery", 400);
  }
  // Fail before creating an order or changing the cart when credentials are
  // absent. Otherwise a customer could lose their cart without a payment URL.
  const vnpay = paymentMethod === "VNPAY" ? vnpayConfig() : null;
  const payos = paymentMethod === "PAYOS" ? payosConfig() : null;

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
    destination: { lat: shippingAddress.lat, lng: shippingAddress.lng },
  });
  const totals = computeOrderTotals(subtotal, deliveryQuote.shippingPrice);
  const voucherApplication = voucherCode
    ? await voucherService.validateVoucherForOrder({
      code: voucherCode,
      userId: user._id,
      itemsPrice: totals.subtotal,
      shippingPrice: totals.deliveryFee,
    })
    : null;
  const discountAmount = voucherApplication?.discountAmount || 0;
  const payableTotal = totals.total - discountAmount;
  const financialSnapshot = {
    restaurantSharePercent: 80,
    platformFoodCommissionPercent: 20,
    shipperDeliverySharePercent: 85,
    platformDeliverySharePercent: 15,
    restaurantPayoutAmount: Math.round(totals.subtotal * 0.8),
    shipperOnlineEarningsAmount: Math.round(totals.deliveryFee * 0.85),
    codLiabilityAmount: Math.round(totals.subtotal + totals.deliveryFee * 0.15),
  };

  const newOrderData = {
    user: user._id,
    orderItems,
    shippingAddress: {
      fullName: shippingAddress.fullName,
      address: shippingAddress.address,
      city: shippingAddress.city,
      state: shippingAddress.state,
      country: shippingAddress.country,
      zipCode: shippingAddress.zipCode,
      phone: shippingAddress.phone,
      lat: shippingAddress.lat ?? null,
      lng: shippingAddress.lng ?? null,
    },
    paymentMethod,
    currency: "VND",
    deliveryMethod: deliveryQuote.deliveryMethod,
    deliveryDistanceKm: deliveryQuote.billedDistanceKm,
    deliveryDistanceType: deliveryQuote.distanceType,
    deliveryRatePerKm: deliveryQuote.ratePerKm,
    financialSnapshot,
    ...(deliveryMethod === "shipper" && {
      pickupLocation: {
        type: "Point",
        coordinates: [restaurant.lng, restaurant.lat],
      },
      shipperAssignmentStatus: "unassigned",
      shipperAssignmentDeadlineAt: new Date(Date.now() + SHIPPER_ASSIGNMENT_WINDOW_MS),
    }),
    itemsPrice: totals.subtotal,
    totalPrice: payableTotal,
    shippingPrice: totals.deliveryFee,
    serviceFee: totals.serviceFee,
    ...(voucherApplication && {
      voucherSnapshot: voucherApplication.snapshot,
      discountAmount,
      discountTargetAmount: voucherApplication.targetAmount,
    }),
    restaurantId: restaurantId,
    isPaid: false,
    paidAt: null,
    orderStatus: isOnlinePayment(paymentMethod) ? "pending_payment" : "pending",
  };
  let newOrder;
  if (voucherApplication) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        newOrder = await orderRepo.create(newOrderData, { session });
        await voucherRepo.reserveForOrder({
          voucher: voucherApplication.voucher,
          userId: user._id,
          orderId: newOrder._id,
          discountAmount,
        }, session);
      });
    } finally {
      await session.endSession();
    }
  } else {
    newOrder = await orderRepo.create(newOrderData);
  }

  let paymentUrl = null;
  if (paymentMethod === "VNPAY") {
    const { tmnCode, hashSecret, returnUrl, paymentUrl: gatewayUrl } = vnpay;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const params = {
      vnp_Amount: String(Math.round(payableTotal) * 100),
      vnp_Command: "pay",
      vnp_CreateDate: vnpayDate(now),
      vnp_CurrCode: "VND",
      vnp_ExpireDate: vnpayDate(expiresAt),
      vnp_IpAddr: vnpayIpAddress(clientIp),
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
    await orderRepo.updateById(newOrder._id, {
      vnpTxnRef: params.vnp_TxnRef,
      vnpCreateDate: params.vnp_CreateDate,
    });
  } else if (paymentMethod === "PAYOS") {
    const orderCode = newPayosOrderCode();
    try {
      // Persist the mapping before asking PayOS to create the link. This
      // removes the tiny race in which a rapid payment webhook arrives before
      // the application knows which orderCode belongs to the order.
      await orderRepo.updateById(newOrder._id, { payosOrderCode: orderCode });
      const paymentLink = await payos.payOS.paymentRequests.create({
        orderCode,
        amount: Math.round(payableTotal),
        description: orderPaymentDescription(newOrder._id),
        items: [
          ...orderItems.map((item) => ({ name: item.name.slice(0, 50), quantity: item.quantity, price: Math.round(item.price) })),
          ...(totals.shippingPrice > 0 ? [{ name: "Phi giao hang", quantity: 1, price: Math.round(totals.shippingPrice) }] : []),
          ...(totals.serviceFee > 0 ? [{ name: "Phi dich vu", quantity: 1, price: Math.round(totals.serviceFee) }] : []),
        ],
        returnUrl: withOrderId(payos.returnUrl, newOrder._id),
        cancelUrl: withOrderId(payos.cancelUrl, newOrder._id),
      });
      paymentUrl = paymentLink.checkoutUrl;
      await orderRepo.updateById(newOrder._id, {
        payosPaymentLinkId: paymentLink.paymentLinkId || null,
      });
    } catch (error) {
      // The cart has not been cleared, so deleting the unfinished record lets
      // the customer retry without leaving a payment-pending ghost order.
      await orderRepo.deleteById(newOrder._id);
      await voucherRepo.releaseForOrder(newOrder._id, "payment_link_creation_failed");
      throw new AppError(`Unable to create PayOS payment link: ${error.message}`, 502);
    }
  } else {
    await cartRepo.deleteByUserId(user._id);
    await userRepo.updateById(user._id, { cart: [] });
  }

  return {
    success: true,
    ...(paymentUrl && { paymentUrl, checkoutUrl: paymentUrl }),
    orderId: newOrder._id,
    restaurantId: restaurantId.toString(),
    deliveryMethod,
    paymentMethod,
    totalPrice: payableTotal,
    message:
      paymentMethod === "COD"
        ? "Order placed with COD"
        : paymentMethod === "VNPAY"
        ? "Order created. Redirecting to VNPay."
        : paymentMethod === "PAYOS"
        ? "Order created. Redirecting to PayOS."
        : "Order created",
  };
};

const verifyVnpayResponse = async (query) => {
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
  return { orderId, order, hashIsValid, amountMatches: Boolean(order) && Number(query.vnp_Amount) === Math.round(order.totalPrice) * 100 };
};

const recordVnpayResult = async (query) => {
  const result = await verifyVnpayResponse(query);
  const { orderId, order, hashIsValid, amountMatches } = result;
  const paid = hashIsValid && amountMatches && query.vnp_ResponseCode === "00";

  if (paid && !order.isPaid) {
    await orderRepo.updateById(orderId, {
      isPaid: true,
      paidAt: Date.now(),
      orderStatus: "pending",
      ...(order.deliveryMethod === "shipper" && {
        shipperAssignmentStatus: "unassigned",
        shipperAssignmentDeadlineAt: new Date(Date.now() + SHIPPER_ASSIGNMENT_WINDOW_MS),
      }),
      vnpTransactionNo: query.vnp_TransactionNo || null,
      paymentResult: { id: query.vnp_TransactionNo, status: query.vnp_ResponseCode, update_time: query.vnp_PayDate },
    });
    return { ...result, paid: true, newlyPaid: true };
  }
  if (hashIsValid && order && !paid && !order.isPaid) {
    await orderRepo.updateById(orderId, { orderStatus: "cancelled", reason: "VNPay payment failed or was cancelled" });
    await voucherRepo.releaseForOrder(orderId, "vnpay_payment_failed");
  }
  return { ...result, paid: Boolean(paid || order?.isPaid), newlyPaid: false };
};

export const handleVnpayReturn = async (query) => recordVnpayResult(query);

export const handleVnpayIpn = async (query) => {
  const result = await verifyVnpayResponse(query);
  if (!result.hashIsValid) return { RspCode: "97", Message: "Invalid signature" };
  if (!result.order) return { RspCode: "01", Message: "Order not found" };
  if (!result.amountMatches) return { RspCode: "04", Message: "Invalid amount" };

  const recorded = await recordVnpayResult(query);
  if (recorded.newlyPaid || query.vnp_ResponseCode !== "00") {
    return { RspCode: "00", Message: "Confirm Success", ...recorded };
  }
  if (recorded.order?.vnpTransactionNo === query.vnp_TransactionNo) {
    return { RspCode: "00", Message: "Confirm Success", ...recorded };
  }
  return { RspCode: "02", Message: "Order already confirmed", ...recorded };
};

/** Verifies a PayOS-signed webhook and settles the matching order once. */
export const handlePayosWebhook = async (payload) => {
  const { payOS } = payosConfig();
  const payment = await payOS.webhooks.verify(payload);
  const orderCode = Number(payment.orderCode);
  if (!Number.isSafeInteger(orderCode)) throw new AppError("Invalid PayOS order code", 400);

  const order = await orderRepo.findByPayosOrderCode(orderCode);
  // PayOS sends a signed sample event while its dashboard validates the
  // webhook URL. Acknowledging an unknown code lets that handshake succeed
  // without ever changing application data.
  if (!order) return { paid: false, newlyPaid: false, orderId: null, ignored: true };
  if (order.paymentMethod !== "PAYOS") throw new AppError("Payment method does not match PayOS", 409);
  if (Math.round(Number(payment.amount)) !== Math.round(order.totalPrice)) {
    throw new AppError("PayOS payment amount does not match the order", 400);
  }
  if (String(payment.code) !== "00") {
    return { paid: Boolean(order.isPaid), newlyPaid: false, orderId: order._id, ignored: true };
  }
  if (order.isPaid) return { paid: true, newlyPaid: false, orderId: order._id };

  await orderRepo.updateById(order._id, {
    isPaid: true,
    paidAt: new Date(),
    orderStatus: "pending",
    ...(order.deliveryMethod === "shipper" && {
      shipperAssignmentStatus: "unassigned",
      shipperAssignmentDeadlineAt: new Date(Date.now() + SHIPPER_ASSIGNMENT_WINDOW_MS),
    }),
    payosPaymentLinkId: payment.paymentLinkId || order.payosPaymentLinkId,
    paymentResult: {
      id: payment.reference || payment.paymentLinkId,
      status: payment.code,
      update_time: payment.transactionDateTime,
    },
  });
  return { paid: true, newlyPaid: true, orderId: order._id };
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
  const reviewFlows = await attachReviewFlows(orders);
  return {
    success: true,
    data: orders.map((order, index) => ({
      ...order.toObject(),
      reviewFlow: reviewFlows[index],
    })),
  };
};

export const customerOrderDetail = async (userId, orderId) => {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError("Order not found", 404);
  }

  const order = await orderRepo.findCustomerDetail(userId, orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  const [reviewFlow] = await attachReviewFlows([order]);
  return {
    success: true,
    data: {
      ...(typeof order.toObject === "function" ? order.toObject() : order),
      reviewFlow,
    },
  };
};

const hasShipperAcceptedOrder = (order) =>
  order.deliveryMethod === "shipper" &&
  (Boolean(order.shipperId) || ["accepted", "picked_up", "completed"].includes(order.shipperAssignmentStatus));

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
    filter = {
      restaurantId: restId,
      // An online order is not actionable until its payment webhook confirms it.
      $or: [{ paymentMethod: "COD" }, { isPaid: true }],
    };
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
    if (order.deliveryMethod === "shipper" && status === "preparing" && order.shipperAssignmentStatus !== "accepted") {
      throw new AppError("Wait for a shipper to accept before preparing this order", 409);
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
      if (!["pending", "pending_payment"].includes(order.orderStatus)) {
        throw new AppError("Chỉ có thể hủy đơn hàng khi đang chờ xác nhận hoặc chưa thanh toán", 400);
      }
      if (hasShipperAcceptedOrder(order)) {
        throw new AppError("Không thể hủy đơn hàng sau khi tài xế đã nhận đơn", 409);
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

  // Gán drone sau khi đã xác thực quyền và trạng thái chuyển đổi đơn hàng hợp lệ
  if (status === "delivering" && order.deliveryMethod === "drone" && !order.droneId) {
    const droneRepo = await import("../repositories/droneRepository.js");
    const crypto = await import("crypto");
    const cargoWeight = Math.floor(Math.random() * 1500) + 500;
    const drone = await droneRepo.claimAvailable(orderId, cargoWeight);

    if (!drone) {
      const stats = await droneRepo.getFleetStats();
      if (stats.total === 0) {
        throw new AppError("Hệ thống chưa có drone nào được cấu hình.", 409);
      }
      if (stats.available === 0) {
        throw new AppError(
          `Hiện tại tất cả ${stats.total} drone đều đang bận giao các đơn hàng khác. Vui lòng đợi drone hoàn tất đơn hoặc quản trị viên điều phối.`,
          409
        );
      }
      if (stats.availableWithBattery === 0) {
        throw new AppError(
          `Các drone sẵn sàng hiện đều có mức pin dưới ${droneRepo.MIN_BATTERY_PERCENT}% và đang sạc. Vui lòng thử lại sau ít phút.`,
          409
        );
      }
      throw new AppError(
        `Không có drone khả dụng với mức pin tối thiểu ${droneRepo.MIN_BATTERY_PERCENT}%. Vui lòng thử lại sau.`,
        409
      );
    }

    const hash = crypto.default.createHash("sha256");
    hash.update(`${orderId}-${Date.now()}-${process.env.JWT_SECRET || "secret"}`);
    const qrCode = hash.digest("hex").substring(0, 16).toUpperCase();

    order.droneId = drone._id;
    order.qrCode = qrCode;
    await order.save();

    try {
      const DroneDeliveryHistory = (await import("../models/droneDeliveryHistoryModel.cjs")).default;
      const restaurant = await restaurantRepo.findById(order.restaurantId);
      const custAddress = typeof order.shippingAddress === "object"
        ? `${order.shippingAddress.address || ""}, ${order.shippingAddress.city || ""}`.trim()
        : String(order.shippingAddress || "Hồ Chí Minh");
      const custName = typeof order.shippingAddress === "object" && order.shippingAddress.fullName
        ? order.shippingAddress.fullName
        : order.user?.name || "Khách hàng";
      const custPhone = typeof order.shippingAddress === "object" && order.shippingAddress.phone
        ? order.shippingAddress.phone
        : order.user?.phone || "";

      await DroneDeliveryHistory.create({
        droneId: drone._id,
        orderId: order._id,
        restaurantId: order.restaurantId?._id || order.restaurantId,
        customerId: order.user?._id || order.user,
        restaurantAddress: restaurant?.address?.fullAddress || restaurant?.address || "Hồ Chí Minh",
        customerAddress: custAddress || "Hồ Chí Minh",
        customerName: custName,
        customerPhone: custPhone,
        startTime: new Date(),
        status: "delivering",
        qrCode,
        cargoWeight,
        totalPrice: order.totalPrice || 0,
      });
    } catch (histErr) {
      console.error("Lỗi khi ghi lịch sử drone delivery:", histErr);
    }
  }

  const previousStatus = order.orderStatus;
  const updateDataObj = { orderStatus: status };
  if (status === "cancelled" && reason) {
    updateDataObj.reason = reason.trim();

    if (order.paymentMethod === "PAYOS" && order.isPaid) {
      throw new AppError("Automatic PayOS refunds are not configured. Refund the customer before cancelling this paid order.", 409);
    }

    if (order.paymentMethod === "PAYOS" && !order.isPaid) {
      try {
        const { payOS } = payosConfig();
        const linkRef = order.payosPaymentLinkId || Number(order.payosOrderCode);
        if (linkRef) {
          await payOS.paymentRequests.cancel(linkRef, reason || "Customer cancelled unpaid order");
        }
      } catch (err) {
        // Safe to ignore if link was already cancelled or expired
      }
    }

    // A paid VNPay order is cancelled only after the gateway has accepted the
    // full-refund request. This prevents the UI from claiming a refund that
    // was never submitted.
    if (order.paymentMethod === "VNPAY" && order.isPaid) {
      const { requestVnpayRefund } = await import("./shipperService.js");
      const refundRequestId = await requestVnpayRefund(order);
      updateDataObj.refundStatus = "requested";
      updateDataObj.refundRequestId = refundRequestId;
      updateDataObj.refundRequestedAt = new Date();
    }
    
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
      try {
        const DroneDeliveryHistory = (await import("../models/droneDeliveryHistoryModel.cjs")).default;
        await DroneDeliveryHistory.findOneAndUpdate(
          { orderId: order._id, droneId: order.droneId },
          { status: "cancelled", endTime: new Date() }
        );
      } catch (err) {}
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
        drone.batteryLevel = Math.max(0, (drone.batteryLevel || 100) - Math.floor(Math.random() * 5 + 5));
        await drone.save();
      }
      try {
        const DroneDeliveryHistory = (await import("../models/droneDeliveryHistoryModel.cjs")).default;
        await DroneDeliveryHistory.findOneAndUpdate(
          { orderId: order._id, droneId: order.droneId },
          { status: "delivered", endTime: new Date() }
        );
      } catch (err) {}
    }

  }

  if (status === "delivered") {
    await settleDeliveredOrder(orderId, {
      deliveredAt: updateDataObj.deliveredAt,
      paidAt: updateDataObj.paidAt,
      shipperCompletedAt: updateDataObj.shipperCompletedAt,
    });
  } else {
    await orderRepo.updateById(orderId, updateDataObj);
    if (status === "cancelled") {
      await voucherRepo.releaseForOrder(orderId, "order_cancelled");
    }
    if (status === "cancelled" && order.codReservationStatus === "reserved") {
      await releaseCodLiability(orderId);
    }
  }
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
