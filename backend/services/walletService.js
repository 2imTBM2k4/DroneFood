import mongoose from "mongoose";
import crypto from "crypto";
import { PayOS } from "@payos/node";
import AppError from "../utils/AppError.js";
import { Order, User, WalletPayment } from "../models/index.cjs";
import * as walletRepo from "../repositories/walletRepository.js";

export const MIN_INITIAL_DEPOSIT = 350000;
export const EARLY_WARNING_RATIO = 0.5;
export const LOCK_RATIO = 0.75;

const runInTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const walletStatus = (deposit, earnings) => {
  const depositBalance = deposit?.balance || 0;
  const earningsBalance = earnings?.balance || 0;
  const reservedWithdrawalAmount = earnings?.reservedWithdrawalAmount || 0;
  const earningsAvailable = earningsBalance - reservedWithdrawalAmount;
  const warningThreshold = -EARLY_WARNING_RATIO * depositBalance;
  const lockThreshold = -LOCK_RATIO * depositBalance;
  return {
    depositBalance,
    earningsBalance,
    earningsAvailable,
    reservedCodLiability: earnings?.reservedCodLiability || 0,
    reservedWithdrawalAmount,
    warningThreshold,
    lockThreshold,
    isEarlyWarning: earningsBalance <= warningThreshold,
    isAcceptanceLocked: earningsBalance <= lockThreshold,
  };
};

/** Returns current shipper balances and dynamic risk thresholds. */
export const getShipperWalletSummary = async (shipperId) => {
  await walletRepo.ensureShipperWallets(shipperId);
  const { deposit, earnings } = await walletRepo.getShipperWallets(shipperId);
  return walletStatus(deposit, earnings);
};

/** Ensures a shipper can accept any new delivery at the dynamic debt limit. */
export const requireShipperCanAcceptOrders = async (shipperId) => {
  const summary = await getShipperWalletSummary(shipperId);
  if (summary.isAcceptanceLocked) {
    throw new AppError("Shipper cannot accept new orders while earnings are at the debt limit", 409);
  }
  return summary;
};

/** Atomically reserves COD exposure after a shipper claims an order. */
export const reserveCodLiability = async (orderId, shipperId) => runInTransaction(async (session) => {
  await walletRepo.ensureShipperWallets(shipperId, session);
  const order = await Order.findOne({ _id: orderId, shipperId, paymentMethod: "COD", deliveryMethod: "shipper" }).session(session);
  if (!order) throw new AppError("COD order is not assigned to this shipper", 409);
  if (order.codReservationStatus === "reserved") return order;
  if (order.codReservationStatus !== "none") throw new AppError("COD reservation cannot be recreated", 409);

  const { deposit, earnings } = await walletRepo.getShipperWallets(shipperId, session);
  const liability = order.financialSnapshot?.codLiabilityAmount || 0;
  const depositBalance = deposit.balance;
  const earningsAvailable = earnings.balance - (earnings.reservedWithdrawalAmount || 0);
  const projectedEarnings = earningsAvailable - earnings.reservedCodLiability - liability;
  const lockThreshold = -LOCK_RATIO * depositBalance;
  const codCapacity = depositBalance + earningsAvailable;

  if (earningsAvailable <= lockThreshold) {
    throw new AppError("Shipper cannot accept new orders while earnings are at the debt limit", 409);
  }
  if (earnings.reservedCodLiability + liability > codCapacity || projectedEarnings <= lockThreshold) {
    throw new AppError("Shipper deposit plus available earnings is insufficient for this COD order", 409);
  }

  const reservedWallet = await walletRepo.updateReservedCodLiability(shipperId, liability, session);
  if (!reservedWallet) throw new AppError("Unable to reserve COD liability", 409);
  const reservedOrder = await walletRepo.reserveOrderCodLiability(orderId, shipperId, liability, session);
  if (!reservedOrder) throw new AppError("COD order reservation changed concurrently", 409);
  return reservedOrder;
});

/** Releases a COD reservation that never reached a successful delivery. */
export const releaseCodLiability = async (orderId) => runInTransaction(async (session) => {
  const order = await Order.findById(orderId).session(session);
  if (!order || order.codReservationStatus !== "reserved") return null;
  const wallet = await walletRepo.updateReservedCodLiability(order.shipperId, -order.codReservedLiability, session);
  if (!wallet) throw new AppError("COD reservation is inconsistent", 409);
  return walletRepo.releaseOrderCodLiability(orderId, session);
});

const addLedgerEntry = async ({ walletType, ownerType, ownerId, amount, balanceAfter, transactionType, eventKey, orderId, paymentId, withdrawalId, closureId, metadata }, session) =>
  walletRepo.createTransaction(
    {
      walletType,
      ownerType,
      ownerId,
      amount,
      balanceBefore: balanceAfter - amount,
      balanceAfter,
      transactionType,
      eventKey,
      orderId,
      paymentId,
      withdrawalId,
      closureId,
      metadata,
    },
    session
  );

/** Settles order money exactly once when delivery succeeds. */
export const settleDeliveredOrder = async (orderId, deliveredFields = {}) => runInTransaction(async (session) => {
  const order = await Order.findById(orderId).session(session);
  if (!order) throw new AppError("Order not found", 404);

  const restaurantEventKey = `order:${order._id}:restaurant-settlement`;
  const existingRestaurantTransaction = await walletRepo.findTransactionByEventKey(restaurantEventKey).session(session);
  if (existingRestaurantTransaction) return { alreadySettled: true, order };

  if (["VNPAY", "PAYOS"].includes(order.paymentMethod) && !order.isPaid) {
    throw new AppError("An online order cannot settle before payment confirmation", 409);
  }

  const itemsSubtotal = typeof order.itemsPrice === "number" && order.itemsPrice > 0
    ? order.itemsPrice
    : order.orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const snapshot = order.financialSnapshot || {};
  const restaurantAmount = snapshot.restaurantPayoutAmount || Math.round(itemsSubtotal * 0.8);
  const onlineEarningsAmount = snapshot.shipperOnlineEarningsAmount || Math.round((order.shippingPrice || 0) * 0.85);
  const codLiabilityAmount = snapshot.codLiabilityAmount || Math.round(itemsSubtotal + (order.shippingPrice || 0) * 0.15);

  const restaurant = await walletRepo.updateRestaurantBalance(order.restaurantId, restaurantAmount, session);
  if (!restaurant) throw new AppError("Restaurant balance update failed", 409);
  const restaurantTransaction = await addLedgerEntry({
    walletType: "restaurant_balance",
    ownerType: "restaurant",
    ownerId: order.restaurantId,
    amount: restaurantAmount,
    balanceAfter: restaurant.balance,
    transactionType: "restaurant_order_settlement",
    eventKey: restaurantEventKey,
    orderId: order._id,
    metadata: { itemsSubtotal, restaurantSharePercent: snapshot.restaurantSharePercent || 80 },
  }, session);

  let shipperTransaction = null;
  if (order.deliveryMethod === "shipper") {
    await walletRepo.ensureShipperWallets(order.shipperId, session);
    if (["VNPAY", "PAYOS"].includes(order.paymentMethod)) {
      const wallet = await walletRepo.updateEarningsBalance(order.shipperId, onlineEarningsAmount, session);
      shipperTransaction = await addLedgerEntry({
        walletType: "shipper_earnings",
        ownerType: "shipper",
        ownerId: order.shipperId,
        amount: onlineEarningsAmount,
        balanceAfter: wallet.balance,
        transactionType: "shipper_online_delivery_earnings",
        eventKey: `order:${order._id}:shipper-online-earnings`,
        orderId: order._id,
        metadata: { shippingPrice: order.shippingPrice, shipperDeliverySharePercent: snapshot.shipperDeliverySharePercent || 85 },
      }, session);
    } else if (order.paymentMethod === "COD") {
      if (order.codReservationStatus !== "reserved") {
        throw new AppError("COD order is missing its liability reservation", 409);
      }
      const released = await walletRepo.updateReservedCodLiability(order.shipperId, -order.codReservedLiability, session);
      if (!released) throw new AppError("COD reservation is inconsistent", 409);
      const wallet = await walletRepo.updateEarningsBalance(order.shipperId, -codLiabilityAmount, session);
      shipperTransaction = await addLedgerEntry({
        walletType: "shipper_earnings",
        ownerType: "shipper",
        ownerId: order.shipperId,
        amount: -codLiabilityAmount,
        balanceAfter: wallet.balance,
        transactionType: "shipper_cod_collection",
        eventKey: `order:${order._id}:shipper-cod-collection`,
        orderId: order._id,
        metadata: { itemsSubtotal, shippingPrice: order.shippingPrice, platformDeliverySharePercent: snapshot.platformDeliverySharePercent || 15 },
      }, session);
      order.codReservationStatus = "released";
      order.codReservedLiability = 0;
    }
  }

  order.orderStatus = "delivered";
  order.isDelivered = true;
  order.deliveredAt = deliveredFields.deliveredAt || new Date();
  if (order.paymentMethod === "COD") {
    order.isPaid = true;
    order.paidAt = deliveredFields.paidAt || new Date();
  }
  if (order.deliveryMethod === "shipper") {
    order.shipperAssignmentStatus = "completed";
    order.shipperCompletedAt = deliveredFields.shipperCompletedAt || new Date();
  }
  order.restaurantSettlementTransaction = restaurantTransaction._id;
  order.shipperSettlementTransaction = shipperTransaction?._id || null;
  if (order.deliveryMethod === "shipper") order.liveShipperRoute = undefined;
  await order.save({ session });
  return { alreadySettled: false, order, restaurantTransaction, shipperTransaction };
});

/** Credits a verified PayOS payment to either shipper wallet exactly once. */
export const settleDepositPayment = async (paymentId, transactionNo = null, provider = "VNPAY") => runInTransaction(async (session) => {
  const payment = await WalletPayment.findById(paymentId).session(session);
  if (!payment) throw new AppError("Shipper wallet payment not found", 404);
  const isEarningsTopUp = payment.purpose === "earnings_top_up";
  const eventKey = `${isEarningsTopUp ? "earnings-top-up" : "deposit-payment"}:${payment._id}`;
  const existing = await walletRepo.findTransactionByEventKey(eventKey).session(session);
  if (existing) return { alreadySettled: true, payment };

  await walletRepo.ensureShipperWallets(payment.shipper, session);
  const { deposit } = await walletRepo.getShipperWallets(payment.shipper, session);
  if (!isEarningsTopUp && deposit.balance === 0 && payment.amount < MIN_INITIAL_DEPOSIT) {
    throw new AppError(`Initial shipper deposit must be at least ${MIN_INITIAL_DEPOSIT}`, 400);
  }
  const updated = isEarningsTopUp
    ? await walletRepo.updateEarningsBalance(payment.shipper, payment.amount, session)
    : await walletRepo.updateDepositBalance(payment.shipper, payment.amount, session);
  const transaction = await addLedgerEntry({
    walletType: isEarningsTopUp ? "shipper_earnings" : "shipper_deposit",
    ownerType: "shipper",
    ownerId: payment.shipper,
    amount: payment.amount,
    balanceAfter: updated.balance,
    transactionType: isEarningsTopUp ? "shipper_earnings_top_up" : "shipper_deposit_top_up",
    eventKey,
    paymentId: payment._id,
    metadata: provider === "PAYOS"
      ? { payosOrderCode: payment.payosOrderCode, payosReference: transactionNo }
      : { vnpTxnRef: payment.vnpTxnRef },
  }, session);
  payment.status = "paid";
  payment.paidAt = new Date();
  if (provider === "PAYOS") payment.payosReference = transactionNo;
  else payment.vnpTransactionNo = transactionNo;
  await payment.save({ session });
  return { alreadySettled: false, payment, transaction };
});

const vnpayDate = (date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
};

const signedVnpayQuery = (params, secret) => crypto.createHmac("sha512", secret)
  .update(new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "").sort(([a], [b]) => a.localeCompare(b))).toString(), "utf8")
  .digest("hex");

const payosDepositConfig = () => {
  const { PAYOS_CLIENT_ID: clientId, PAYOS_API_KEY: apiKey, PAYOS_CHECKSUM_KEY: checksumKey } = process.env;
  if (!clientId || !apiKey || !checksumKey) {
    throw new AppError("PayOS is not configured. Set PAYOS_CLIENT_ID, PAYOS_API_KEY and PAYOS_CHECKSUM_KEY.", 503);
  }
  const webhookUrl = process.env.PAYOS_WEBHOOK_URL;
  const defaultReturnUrl = webhookUrl
    ? new URL("/api/wallet/payos/deposit-return", webhookUrl).toString()
    : process.env.PAYOS_RETURN_URL || `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify`;
  const returnUrl = process.env.PAYOS_DEPOSIT_RETURN_URL || defaultReturnUrl;
  const cancelUrl = process.env.PAYOS_DEPOSIT_CANCEL_URL || returnUrl;
  try {
    new URL(returnUrl);
    new URL(cancelUrl);
  } catch {
    throw new AppError("PAYOS_DEPOSIT_RETURN_URL and PAYOS_DEPOSIT_CANCEL_URL must be absolute URLs.", 503);
  }
  return { payOS: new PayOS({ clientId, apiKey, checksumKey }), returnUrl, cancelUrl };
};

// The final digit identifies the PayOS purpose: 1 = customer order (defined
// in orderService), 2 = shipper deposit, 3 = shipper earnings top-up. This keeps all flows disjoint even
// though they share a single PayOS channel and webhook URL.
const newPayosDepositOrderCode = () => Number(`${Math.floor(Date.now() / 1000)}${crypto.randomInt(10000, 100000)}2`);
const newPayosEarningsTopUpOrderCode = () => Number(`${Math.floor(Date.now() / 1000)}${crypto.randomInt(10000, 100000)}3`);

const paymentDate = (date = new Date()) => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "2-digit",
}).format(date).replace(/\//g, "");

const bankSafeName = (name) => String(name || "Shipper")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]/g, "")
  .slice(0, 7) || "Shipper";

// `Nap ky quy ` + a seven-character name + ` ` + DDMMYY is at most 25
// characters, which keeps the bank-transfer reference readable and compact.
const depositPaymentDescription = (shipperName, date = new Date()) =>
  `Nap ky quy ${bankSafeName(shipperName)} ${paymentDate(date)}`;

const earningsTopUpPaymentDescription = (shipperName, date = new Date()) =>
  `Nap vi ${bankSafeName(shipperName)} ${paymentDate(date)}`;

/** Creates a PayOS payment link for a shipper's deposit. */
export const createDepositPayment = async (shipperId, amount) => {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new AppError("Deposit amount must be a positive VND integer", 400);
  const { payOS, returnUrl, cancelUrl } = payosDepositConfig();
  const shipper = await User.findById(shipperId).select("name").lean();
  if (!shipper) throw new AppError("Shipper not found", 404);
  const orderCode = newPayosDepositOrderCode();
  const payment = await walletRepo.createPayment({
    shipper: shipperId, amount, purpose: "deposit", paymentProvider: "PAYOS", payosOrderCode: orderCode,
  });
  try {
    const paymentLink = await payOS.paymentRequests.create({
      orderCode,
      amount,
      description: depositPaymentDescription(shipper.name),
      items: [{ name: "Nap ky quy shipper", quantity: 1, price: amount }],
      returnUrl,
      cancelUrl,
    });
    payment.payosPaymentLinkId = paymentLink.paymentLinkId;
    await payment.save();
    return { success: true, paymentId: payment._id, checkoutUrl: paymentLink.checkoutUrl, paymentUrl: paymentLink.checkoutUrl };
  } catch (error) {
    await walletRepo.deletePaymentById(payment._id);
    throw new AppError(`Unable to create PayOS deposit payment link: ${error.message}`, 502);
  }
};

/** Creates a PayOS link that repays/credits the shipper earnings wallet. */
export const createEarningsTopUpPayment = async (shipperId, amount) => {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new AppError("Earnings top-up amount must be a positive VND integer", 400);
  const { payOS, returnUrl, cancelUrl } = payosDepositConfig();
  const shipper = await User.findById(shipperId).select("name").lean();
  if (!shipper) throw new AppError("Shipper not found", 404);
  const orderCode = newPayosEarningsTopUpOrderCode();
  const payment = await walletRepo.createPayment({
    shipper: shipperId, amount, purpose: "earnings_top_up", paymentProvider: "PAYOS", payosOrderCode: orderCode,
  });
  try {
    const paymentLink = await payOS.paymentRequests.create({
      orderCode,
      amount,
      description: earningsTopUpPaymentDescription(shipper.name),
      items: [{ name: "Nap vi earnings shipper", quantity: 1, price: amount }],
      returnUrl,
      cancelUrl,
    });
    payment.payosPaymentLinkId = paymentLink.paymentLinkId;
    await payment.save();
    return { success: true, paymentId: payment._id, checkoutUrl: paymentLink.checkoutUrl, paymentUrl: paymentLink.checkoutUrl };
  } catch (error) {
    await walletRepo.deletePaymentById(payment._id);
    throw new AppError(`Unable to create PayOS earnings top-up link: ${error.message}`, 502);
  }
};

/** Verifies PayOS webhook data and credits a matching shipper deposit once. */
export const handleShipperWalletPayosWebhook = async (payload) => {
  const { payOS } = payosDepositConfig();
  const data = await payOS.webhooks.verify(payload);
  const orderCode = Number(data.orderCode);
  if (!Number.isSafeInteger(orderCode)) throw new AppError("Invalid PayOS shipper wallet order code", 400);
  const payment = await walletRepo.findPaymentByPayosOrderCode(orderCode);
  // This also accepts PayOS's signed sample event during webhook setup.
  if (!payment) return { newlyPaid: false, ignored: true };
  if (payment.paymentProvider !== "PAYOS") throw new AppError("Payment provider does not match PayOS", 409);
  if (Math.round(Number(data.amount)) !== Math.round(payment.amount)) throw new AppError("PayOS shipper wallet amount does not match", 400);
  if (String(data.code) !== "00") return { newlyPaid: false, ignored: true };
  const settled = await settleDepositPayment(payment._id, data.reference || data.paymentLinkId, "PAYOS");
  return { newlyPaid: !settled.alreadySettled, paymentId: payment._id, purpose: payment.purpose, transaction: settled.transaction || null, ignored: false };
};

// Kept for existing callers and legacy webhook tests.
export const handleDepositPayosWebhook = handleShipperWalletPayosWebhook;

/** Verifies a deposit IPN before crediting the deposit balance. */
export const handleDepositVnpayIpn = async (query) => {
  const hashSecret = process.env.VNPAY_HASH_SECRET;
  if (!hashSecret) return { RspCode: "99", Message: "VNPay is not configured" };
  const receivedHash = query.vnp_SecureHash;
  const signed = Object.fromEntries(Object.entries(query).filter(([key]) => !["vnp_SecureHash", "vnp_SecureHashType"].includes(key)));
  const expectedHash = signedVnpayQuery(signed, hashSecret);
  if (typeof receivedHash !== "string" || receivedHash !== expectedHash) return { RspCode: "97", Message: "Invalid signature" };
  const payment = await walletRepo.findPaymentByReference(query.vnp_TxnRef);
  if (!payment) return { RspCode: "01", Message: "Payment not found" };
  if (Number(query.vnp_Amount) !== payment.amount * 100) return { RspCode: "04", Message: "Invalid amount" };
  if (query.vnp_ResponseCode !== "00") {
    if (payment.status === "pending") { payment.status = "failed"; await payment.save(); }
    return { RspCode: "00", Message: "Confirm Success" };
  }
  const settled = await settleDepositPayment(payment._id, query.vnp_TransactionNo || null);
  return { RspCode: "00", Message: "Confirm Success", settlement: settled };
};

export const listShipperTransactions = async (shipperId) => walletRepo.listTransactions({ ownerId: shipperId });

/** Aggregates settled online-delivery earnings in the Vietnam timezone. */
export const getShipperEarningsReport = async (shipperId) => {
  const transactions = await walletRepo.listShipperOnlineEarnings(shipperId);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const daily = new Map();
  const monthly = new Map();

  for (const transaction of transactions) {
    const parts = Object.fromEntries(formatter.formatToParts(transaction.createdAt)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]));
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    const month = `${parts.year}-${parts.month}`;
    for (const [collection, period] of [[daily, day], [monthly, month]]) {
      const current = collection.get(period) || { period, amount: 0, deliveries: 0 };
      current.amount += transaction.amount;
      current.deliveries += 1;
      collection.set(period, current);
    }
  }

  const toDescendingList = (collection) => [...collection.values()]
    .sort((left, right) => right.period.localeCompare(left.period));
  return {
    totalEarned: transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    daily: toDescendingList(daily),
    monthly: toDescendingList(monthly),
  };
};

export { runInTransaction, addLedgerEntry };
