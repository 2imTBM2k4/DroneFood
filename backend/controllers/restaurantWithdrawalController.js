import * as service from "../services/restaurantWithdrawalService.js";

const respond = (handler) => async (req, res) => {
  try { res.json(await handler(req, res)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

export const create = respond(async (req) => ({ success: true, data: await service.createWithdrawal(req.user, req.body.amount) }));
export const list = respond(async (req) => ({ success: true, data: await service.listWithdrawals(req.user) }));
export const complete = respond(async (req) => ({ success: true, data: await service.completeWithdrawal(req.user, req.params.id) }));
