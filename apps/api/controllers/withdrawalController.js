import * as withdrawalService from "../services/withdrawalService.js";
import { notifyAdmins, notifyWithdrawalOwner, notifyWalletTransaction } from "../utils/notificationEvents.js";

const respond = (handler) => async (req, res) => {
  try { res.json(await handler(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

export const createShipper = respond(async (req) => {
  const request = await withdrawalService.createShipperWithdrawal(req.user, req.body.amount);
  await notifyAdmins(req.app.get("io"), {
    type: "withdrawal.requested", title: "Có yêu cầu rút tiền mới", body: "Một tài xế đang chờ xử lý yêu cầu rút tiền.",
    data: { withdrawalId: String(request._id), path: "/withdrawals" }, eventKey: `withdrawal:${request._id}:requested`,
  });
  return { success: true, data: request };
});
export const listShipper = respond(async (req) => ({
  success: true, data: await withdrawalService.listShipperWithdrawals(req.user),
}));
export const listAdmin = respond(async (req) => ({
  success: true, data: await withdrawalService.listAdminWithdrawals(req.query.status),
}));
export const payoutDetails = async (req, res) => {
  try {
    const data = await withdrawalService.payoutDetails(req.user, req.params.id);
    res.set("Cache-Control", "no-store").json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
export const approve = respond(async (req) => {
  const result = await withdrawalService.approveWithdrawal(req.user, req.params.id);
  if (!result.alreadyApproved) await notifyWithdrawalOwner(req.app.get("io"), result.request, "approved");
  return { success: true, data: result };
});
export const paid = respond(async (req) => {
  const result = await withdrawalService.payWithdrawal(req.user, req.params.id, req.body.bankTransactionReference);
  if (!result.alreadyPaid) await Promise.all([
    notifyWithdrawalOwner(req.app.get("io"), result.request, "paid"),
    notifyWalletTransaction(req.app.get("io"), result.transaction),
  ]);
  return { success: true, data: result };
});
export const reject = respond(async (req) => {
  const result = await withdrawalService.rejectWithdrawal(req.user, req.params.id, req.body.reason);
  if (!result.alreadyRejected) await notifyWithdrawalOwner(req.app.get("io"), result.request, "rejected");
  return { success: true, data: result };
});
