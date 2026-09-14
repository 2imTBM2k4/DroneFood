import * as shipperService from "../services/shipperService.js";
import { emitCustomerOrderUpdate } from "../utils/orderRealtime.js";

const respond = (handler) => async (req, res) => {
  try { res.json(await handler(req, res)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

export const me = respond((req) => shipperService.me(req.user._id));
export const location = respond((req) => shipperService.updateLocation(req.user._id, req.body));
export const status = respond((req) => shipperService.updateStatus(req.user._id, req.body.status));
export const available = respond((req) => shipperService.availableOrders(req.user._id));
export const current = respond((req) => shipperService.currentOrder(req.user._id));
export const accept = respond(async (req) => {
  const result = await shipperService.acceptOrder(req.user, req.params.id);
  await emitCustomerOrderUpdate(req.app.get("io"), req.params.id);
  return result;
});
export const pickup = respond(async (req) => {
  const result = await shipperService.pickupOrder(req.user, req.params.id);
  await emitCustomerOrderUpdate(req.app.get("io"), req.params.id);
  return result;
});
export const complete = respond(async (req) => {
  const result = await shipperService.completeOrder(req.user, req.params.id);
  await emitCustomerOrderUpdate(req.app.get("io"), req.params.id);
  return result;
});
export const decline = respond((req) => shipperService.declineOrder(req.user, req.params.id, req.body.reason));
export const approve = respond((req) => shipperService.approveProfile(req.user, req.params.userId, req.body.approvalStatus));
export const list = respond(() => shipperService.listProfiles());
