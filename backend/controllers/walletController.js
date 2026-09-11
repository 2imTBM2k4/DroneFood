import * as walletService from "../services/walletService.js";

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

export const depositVnpayIpn = async (req, res) => {
  try {
    res.json(await walletService.handleDepositVnpayIpn(req.query));
  } catch {
    res.json({ RspCode: "99", Message: "Unknown error" });
  }
};
