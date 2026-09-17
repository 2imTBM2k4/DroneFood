import * as shipperService from "../services/shipperService.js";
import * as bankAccountService from "../services/bankAccountService.js";
import { emitCustomerOrderUpdate, emitCustomerShipperLocation } from "../utils/orderRealtime.js";
import { notifyCustomerShipperAccepted, notifyCustomerOrderStatus, notifyShippersNewOrder, notifyWalletTransaction } from "../utils/notificationEvents.js";

const respond = (handler) => async (req, res) => {
  try { res.json(await handler(req, res)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

export const me = respond((req) => shipperService.me(req.user._id));
export const bankAccount = respond((req) => bankAccountService.getShipperBankAccount(req.user._id));
export const updateBankAccount = respond((req) => bankAccountService.updateShipperBankAccount(req.user, req.body));
export const location = respond(async (req) => {
  const result = await shipperService.updateLocation(req.user._id, req.body);
  await emitCustomerShipperLocation(req.app.get("io"), req.user._id, result.data);
  return result;
});
export const status = respond((req) => shipperService.updateStatus(req.user._id, req.body.status));
export const available = respond((req) => shipperService.availableOrders(req.user._id));
export const current = respond((req) => shipperService.currentOrder(req.user._id));
export const accept = respond(async (req) => {
  const result = await shipperService.acceptOrder(req.user, req.params.id);
  await emitCustomerOrderUpdate(req.app.get("io"), req.params.id);
  await notifyCustomerShipperAccepted(req.app.get("io"), req.params.id);
  return result;
});
export const pickup = respond(async (req) => {
  const result = await shipperService.pickupOrder(req.user, req.params.id);
  await emitCustomerOrderUpdate(req.app.get("io"), req.params.id);
  await notifyCustomerOrderStatus(req.app.get("io"), req.params.id);
  return result;
});
export const arrive = respond(async (req) => {
  const result = await shipperService.arriveAtDelivery(req.user, req.params.id);
  await emitCustomerOrderUpdate(req.app.get("io"), req.params.id);
  await notifyCustomerOrderStatus(req.app.get("io"), req.params.id);
  return result;
});
export const complete = respond(async (req) => {
  const result = await shipperService.completeOrder(req.user, req.params.id);
  await emitCustomerOrderUpdate(req.app.get("io"), req.params.id);
  await notifyCustomerOrderStatus(req.app.get("io"), req.params.id);
  if (!result.settlement?.alreadySettled) {
    await Promise.all([
      notifyWalletTransaction(req.app.get("io"), result.settlement?.restaurantTransaction),
      notifyWalletTransaction(req.app.get("io"), result.settlement?.shipperTransaction),
    ]);
  }
  return result;
});
export const decline = respond((req) => shipperService.declineOrder(req.user, req.params.id, req.body.reason));
export const extendSearch = respond(async (req) => {
  const result = await shipperService.extendSearch(req.user, req.params.id);
  const shipperIds = await shipperService.nearbyAvailableShipperIds(result.data.pickupLocation);
  shipperIds.forEach((shipperId) => req.app.get("io")?.to(`shipper_${shipperId}`).emit("shipperOrderOffer", {
    orderId: result.data._id,
    expiresAt: result.data.shipperAssignmentDeadlineAt,
  }));
  await notifyShippersNewOrder(req.app.get("io"), result.data._id, shipperIds);
  await emitCustomerOrderUpdate(req.app.get("io"), result.data._id);
  return result;
});
export const approve = respond((req) => shipperService.approveProfile(req.user, req.params.userId, req.body.approvalStatus));
export const list = respond(() => shipperService.listProfiles());
export const history = respond((req) => shipperService.orderHistory(req.user._id));

