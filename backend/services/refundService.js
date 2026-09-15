import mongoose from "mongoose";
import AppError from "../utils/AppError.js";
import * as orderRepo from "../repositories/orderRepository.js";
import * as refundRepo from "../repositories/refundRequestRepository.js";
import * as voucherRepo from "../repositories/voucherRepository.js";
import { RefundRequest } from "../models/index.cjs";
import { recordAudit } from "../utils/auditLog.js";
import { decryptBankAccountNumber, encryptBankAccountNumber } from "../utils/bankAccountCrypto.js";

const hasShipperAcceptedOrder = (order) =>
  order.deliveryMethod === "shipper" &&
  (Boolean(order.shipperId) || ["accepted", "picked_up", "completed"].includes(order.shipperAssignmentStatus));

const canRequestManualRefund = (order) =>
  !hasShipperAcceptedOrder(order) &&
  (order.orderStatus === "pending" ||
    (order.orderStatus === "cancelled" && order.cancellationCode === "NO_SHIPPER_AVAILABLE") ||
    (order.deliveryMethod === "shipper" &&
      order.orderStatus === "preparing" &&
      order.shipperAssignmentStatus === "expired"));

const refundBankSnapshot = (bank) => {
  const accountNumber = String(bank.accountNumber || "").replace(/\s/g, "");
  if (!accountNumber) throw new AppError("Bank account number is required", 400);
  return {
    bank: {
      bankName: bank.bankName.trim(),
      accountHolder: bank.accountHolder.trim(),
      accountNumberLast4: accountNumber.slice(-4),
    },
    bankAccountEncrypted: encryptBankAccountNumber(accountNumber),
  };
};

export const requestManualPayosRefund = async (customer, { orderId, reason, bank }) => {
  const order = await orderRepo.findById(orderId);
  if (!order) throw new AppError("Order not found", 404);
  if (String(order.user._id) !== String(customer._id)) throw new AppError("Unauthorized", 403);
  if (order.paymentMethod !== "PAYOS" || !order.isPaid) {
    throw new AppError("Only paid PayOS orders can use this refund workflow", 409);
  }
  if (!canRequestManualRefund(order)) {
    throw new AppError("This order can no longer be cancelled", 409);
  }

  const session = await mongoose.startSession();
  let refund;
  try {
    await session.withTransaction(async () => {
      const existing = await RefundRequest.findOne({ order: order._id }).session(session);
      if (existing && existing.status !== "rejected") {
        throw new AppError("A refund request already exists for this order", 409);
      }
      refund = existing
        ? await refundRepo.updateById(existing._id, {
          amount: order.totalPrice,
          reason,
          ...refundBankSnapshot(bank),
          status: "requested",
          processedBy: null,
          processedAt: null,
          transferReference: "",
          adminNote: "",
        }, { session })
        : await refundRepo.create({
          order: order._id,
          customer: customer._id,
          amount: order.totalPrice,
          reason,
          ...refundBankSnapshot(bank),
        }, { session });
      await orderRepo.updateById(order._id, {
        orderStatus: "refund_pending",
        refundStatus: "requested",
        refundRequestedAt: new Date(),
        reason,
      }, { session });
    });
  } finally {
    await session.endSession();
  }
  await recordAudit({
    actor: customer,
    action: "refund_requested",
    targetType: "order",
    targetId: order._id,
    category: "money",
    metadata: { refundRequestId: refund._id },
  });
  return refund;
};

export const listManualRefunds = (query) => refundRepo.findAll(query);

/**
 * A manual refund has no approval phase. Per the confirmed policy, an admin
 * may reveal its frozen payment destination while it remains requested.
 */
export const payoutDetails = async (admin, refundId) => {
  const refund = await refundRepo.findByIdForPayoutDetails(refundId);
  if (!refund) throw new AppError("Refund request not found", 404);
  if (refund.status !== "requested") {
    throw new AppError("Bank details are available only for a requested refund", 409);
  }

  const snapshot = refund.bank || {};
  let accountNumber;
  if (refund.bankAccountEncrypted) {
    accountNumber = decryptBankAccountNumber(refund.bankAccountEncrypted);
  } else if (snapshot.accountNumber) {
    // Old records predate encrypted storage. Migrate a record only when an
    // authorized admin intentionally opens it, then remove its plaintext.
    accountNumber = String(snapshot.accountNumber).replace(/\s/g, "");
    await RefundRequest.updateOne(
      { _id: refund._id, bankAccountEncrypted: { $in: [null, ""] } },
      {
        $set: {
          "bank.accountNumberLast4": accountNumber.slice(-4),
          bankAccountEncrypted: encryptBankAccountNumber(accountNumber),
        },
        $unset: { "bank.accountNumber": "" },
      }
    );
  } else {
    throw new AppError("Refund request has no bank account details", 409);
  }

  const accountNumberLast4 = snapshot.accountNumberLast4 || accountNumber.slice(-4);
  await recordAudit({
    actor: admin,
    action: "refund.payout_details_viewed",
    targetType: "refund",
    targetId: refund._id,
    category: "banking",
    metadata: { accountNumberLast4 },
  });
  return {
    bankName: snapshot.bankName,
    accountHolder: snapshot.accountHolder,
    accountNumber,
    accountNumberMasked: `•••• ${accountNumberLast4}`,
  };
};

export const markManualRefundPaid = async (admin, refundId, { transferReference, adminNote = "" }) => {
  const refund = await refundRepo.findById(refundId);
  if (!refund) throw new AppError("Refund request not found", 404);
  if (refund.status !== "requested") throw new AppError("Refund request has already been processed", 409);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await refundRepo.updateById(refund._id, {
        status: "paid", processedBy: admin._id, processedAt: new Date(), transferReference, adminNote,
      }, { session });
      await orderRepo.updateById(refund.order._id, {
        orderStatus: "cancelled", refundStatus: "paid", refundRequestId: transferReference,
      }, { session });
      await voucherRepo.releaseForOrder(refund.order._id, "manual_refund_paid", session);
    });
  } finally {
    await session.endSession();
  }
  await recordAudit({
    actor: admin,
    action: "manual_refund_paid",
    targetType: "order",
    targetId: refund.order._id,
    category: "money",
    metadata: { refundRequestId: refund._id, transferReference },
  });
  return { orderId: refund.order._id, refundId: refund._id };
};

export const rejectManualRefund = async (admin, refundId, { adminNote }) => {
  const refund = await refundRepo.findById(refundId);
  if (!refund) throw new AppError("Refund request not found", 404);
  if (refund.status !== "requested") throw new AppError("Refund request has already been processed", 409);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await refundRepo.updateById(refund._id, {
        status: "rejected", processedBy: admin._id, processedAt: new Date(), adminNote,
      }, { session });
      await orderRepo.updateById(refund.order._id, {
        orderStatus: "pending", refundStatus: "rejected",
      }, { session });
    });
  } finally {
    await session.endSession();
  }
  await recordAudit({
    actor: admin,
    action: "manual_refund_rejected",
    targetType: "order",
    targetId: refund.order._id,
    category: "money",
    metadata: { refundRequestId: refund._id },
  });
  return { orderId: refund.order._id, refundId: refund._id };
};
