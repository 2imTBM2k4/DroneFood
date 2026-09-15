import mongoose from "mongoose";
import AppError from "../utils/AppError.js";
import * as orderRepo from "../repositories/orderRepository.js";
import * as refundRepo from "../repositories/refundRequestRepository.js";
import * as voucherRepo from "../repositories/voucherRepository.js";
import { RefundRequest } from "../models/index.cjs";
import { recordAudit } from "../utils/auditLog.js";

const canRequestManualRefund = (order) => order.orderStatus === "pending" || (
  order.orderStatus === "cancelled" && order.cancellationCode === "NO_SHIPPER_AVAILABLE"
) || (
  order.deliveryMethod === "shipper" &&
  order.orderStatus === "preparing" &&
  order.shipperAssignmentStatus === "expired"
);

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
          bank,
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
          bank,
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
