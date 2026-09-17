import * as pushTokenService from "../services/pushTokenService.js";

const respond = (handler) => async (req, res) => {
  try { res.json({ success: true, data: await handler(req) }); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

export const register = respond((req) => pushTokenService.register(req.user, req.body));
export const unregister = respond((req) => pushTokenService.unregister(req.user, req.body));
