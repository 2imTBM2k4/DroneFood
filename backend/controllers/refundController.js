import * as refundService from "../services/refundService.js";
import { emitCustomerOrderUpdate } from "../utils/orderRealtime.js";

const sendError = (res, error) => res.status(error.statusCode || 500).json({ success: false, message: error.message });

export const requestManualRefund = async (req, res) => {
  try {
    const refund = await refundService.requestManualPayosRefund(req.user, req.body);
    await emitCustomerOrderUpdate(req.app.get("io"), refund.order);
    res.status(201).json({ success: true, data: refund });
  }
  catch (error) { sendError(res, error); }
};
export const listManualRefunds = async (req, res) => {
  try { res.json({ success: true, data: await refundService.listManualRefunds(req.query) }); }
  catch (error) { sendError(res, error); }
};
export const payoutDetails = async (req, res) => {
  try {
    const data = await refundService.payoutDetails(req.user, req.params.id);
    res.set("Cache-Control", "no-store").json({ success: true, data });
  } catch (error) { sendError(res, error); }
};
export const markManualRefundPaid = async (req, res) => {
  try {
    const result = await refundService.markManualRefundPaid(req.user, req.params.id, req.body);
    await emitCustomerOrderUpdate(req.app.get("io"), result.orderId);
    res.json({ success: true, data: result });
  }
  catch (error) { sendError(res, error); }
};
export const rejectManualRefund = async (req, res) => {
  try {
    const result = await refundService.rejectManualRefund(req.user, req.params.id, req.body);
    await emitCustomerOrderUpdate(req.app.get("io"), result.orderId);
    res.json({ success: true, data: result });
  }
  catch (error) { sendError(res, error); }
};
