import * as notificationService from "../services/notificationService.js";

const respond = (handler) => async (req, res) => {
  try { res.json({ success: true, data: await handler(req) }); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

export const listMine = respond((req) => notificationService.listMine(req.user, req.query));
export const unreadCountMine = respond((req) => notificationService.unreadCountMine(req.user));
export const markMineRead = respond((req) => notificationService.markMineRead(req.user, req.params.id));
export const markAllMineRead = respond((req) => notificationService.markAllMineRead(req.user));
