import * as withdrawalService from "../services/withdrawalService.js";

const respond = (handler) => async (req, res) => {
  try { res.json(await handler(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

export const createShipper = respond(async (req) => ({
  success: true, data: await withdrawalService.createShipperWithdrawal(req.user, req.body.amount),
}));
export const listShipper = respond(async (req) => ({
  success: true, data: await withdrawalService.listShipperWithdrawals(req.user),
}));
export const listAdmin = respond(async (req) => ({
  success: true, data: await withdrawalService.listAdminWithdrawals(req.query.status),
}));
export const approve = respond(async (req) => ({
  success: true, data: await withdrawalService.approveWithdrawal(req.user, req.params.id),
}));
export const paid = respond(async (req) => ({
  success: true, data: await withdrawalService.payWithdrawal(req.user, req.params.id, req.body.bankTransactionReference),
}));
export const reject = respond(async (req) => ({
  success: true, data: await withdrawalService.rejectWithdrawal(req.user, req.params.id, req.body.reason),
}));
