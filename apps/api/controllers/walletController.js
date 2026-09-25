import * as walletService from "../services/walletService.js";
import { notifyWalletTransaction } from "../utils/notificationEvents.js";

const respond = (handler) => async (req, res) => {
  try {
    res.json(await handler(req, res));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const shipperSummary = respond(async (req) => ({
  success: true,
  data: await walletService.getShipperWalletSummary(req.user._id),
}));

export const shipperTransactions = respond(async (req) => ({
  success: true,
  data: await walletService.listShipperTransactions(req.user._id),
}));

export const shipperEarningsReport = respond(async (req) => ({
  success: true,
  data: await walletService.getShipperEarningsReport(req.user._id),
}));

export const createDepositPayment = respond((req) =>
  walletService.createDepositPayment(req.user._id, req.body.amount, req.ip)
);

export const createEarningsTopUpPayment = respond((req) =>
  walletService.createEarningsTopUpPayment(req.user._id, req.body.amount, req.ip)
);

export const depositVnpayIpn = async (req, res) => {
  try {
    const result = await walletService.handleDepositVnpayIpn(req.query);
    if (!result.settlement?.alreadySettled) await notifyWalletTransaction(req.app.get("io"), result.settlement?.transaction);
    res.json({ RspCode: result.RspCode, Message: result.Message });
  } catch {
    res.json({ RspCode: "99", Message: "Unknown error" });
  }
};

export const payosDepositReturn = (req, res) => {
  const cancelled = req.query.cancel === "true" || req.query.status === "CANCELLED";
  res.status(200).send(`<!doctype html><html lang="vi"><meta charset="utf-8"><title>DroneFood</title><body><h2>${cancelled ? "Đã hủy nạp ví" : "Đang xác nhận nạp ví"}</h2><p>${cancelled ? "Bạn có thể quay lại ứng dụng Shipper." : "Nếu giao dịch thành công, số dư sẽ được cập nhật trong ứng dụng Shipper. Bạn có thể quay lại và làm mới số dư."}</p></body></html>`);
};
