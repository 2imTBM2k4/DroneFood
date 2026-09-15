import * as voucherService from "../services/voucherService.js";

const sendError = (res, error) =>
  res.status(error.statusCode || 500).json({ success: false, message: error.message });

export const createVoucher = async (req, res) => {
  try {
    const data = await voucherService.createVoucher(req.user, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) { sendError(res, error); }
};

export const listVouchers = async (req, res) => {
  try {
    const result = await voucherService.listVouchers(req.query);
    res.json({ success: true, ...result });
  } catch (error) { sendError(res, error); }
};

export const updateVoucher = async (req, res) => {
  try {
    const data = await voucherService.updateVoucher(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) { sendError(res, error); }
};

export const setVoucherEnabled = async (req, res) => {
  try {
    const data = await voucherService.setVoucherEnabled(req.params.id, req.body.enabled);
    res.json({ success: true, data });
  } catch (error) { sendError(res, error); }
};
