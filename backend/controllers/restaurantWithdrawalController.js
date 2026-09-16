import * as service from "../services/restaurantWithdrawalService.js";
import { notifyAdmins, notifyWithdrawalOwner } from "../utils/notificationEvents.js";

const respond = (handler) => async (req, res) => {
  try { res.json(await handler(req, res)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

export const create = respond(async (req) => {
  const request = await service.createWithdrawal(req.user, req.body.amount);
  await notifyAdmins(req.app.get("io"), {
    type: "withdrawal.requested", title: "Có yêu cầu rút tiền mới", body: "Một nhà hàng đang chờ xử lý yêu cầu rút tiền.",
    data: { withdrawalId: String(request._id), path: "/withdrawals" }, eventKey: `withdrawal:${request._id}:requested`,
  });
  return { success: true, data: request };
});
export const list = respond(async (req) => ({ success: true, data: await service.listWithdrawals(req.user) }));
export const transactions = respond(async (req) => ({ success: true, data: await service.listTransactions(req.user) }));
export const approve = respond(async (req) => {
  const result = await service.approveWithdrawalRequest(req.user, req.params.id);
  if (!result.alreadyApproved) await notifyWithdrawalOwner(req.app.get("io"), result.request, "approved");
  return { success: true, data: result };
});
export const paid = respond(async (req) => {
  const result = await service.payWithdrawalRequest(req.user, req.params.id, req.body.bankTransactionReference);
  if (!result.alreadyPaid) await notifyWithdrawalOwner(req.app.get("io"), result.request, "paid");
  return { success: true, data: result };
});
export const reject = respond(async (req) => {
  const result = await service.rejectWithdrawalRequest(req.user, req.params.id, req.body.reason);
  if (!result.alreadyRejected) await notifyWithdrawalOwner(req.app.get("io"), result.request, "rejected");
  return { success: true, data: result };
});
