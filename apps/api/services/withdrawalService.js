import AppError from "../utils/AppError.js";
import * as restaurantRepo from "../repositories/restaurantRepository.js";
import * as withdrawalRepo from "../repositories/restaurantWithdrawalRepository.js";
import * as walletRepo from "../repositories/walletRepository.js";
import { addLedgerEntry, runInTransaction } from "./walletService.js";
import { recordAudit } from "../utils/auditLog.js";
import {
  restaurantWithdrawalBankAccountSnapshot,
  shipperWithdrawalBankAccountSnapshot,
} from "./bankAccountService.js";
import { decryptBankAccountNumber } from "../utils/bankAccountCrypto.js";
import { logger } from "../utils/logger.js";

export const MIN_WITHDRAWAL = 500000;
export const MAX_WITHDRAWALS_PER_DAY = 3;

export const vietnamDayRange = (date = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

const restaurantForOwner = async (user) => {
  const restaurant = user.restaurantId
    ? await restaurantRepo.findById(user.restaurantId)
    : await restaurantRepo.findByOwner(user._id);
  if (!restaurant) throw new AppError("Restaurant not found", 404);
  if (String(restaurant.owner?._id || restaurant.owner) !== String(user._id)) {
    throw new AppError("Unauthorized: Not your restaurant", 403);
  }
  return restaurant;
};

const reserve = (request, session) => request.actorType === "restaurant"
  ? walletRepo.reserveRestaurantWithdrawal(request.restaurant, request.amount, session)
  : walletRepo.reserveEarningsWithdrawal(request.shipper, request.amount, session);

const release = (request, amount, session) => request.actorType === "restaurant"
  ? walletRepo.releaseRestaurantWithdrawal(request.restaurant, amount, session)
  : walletRepo.releaseEarningsWithdrawal(request.shipper, amount, session);

const debit = (request, amount, session) => request.actorType === "restaurant"
  ? walletRepo.debitReservedRestaurantWithdrawal(request.restaurant, amount, session)
  : walletRepo.debitReservedEarningsWithdrawal(request.shipper, amount, session);

const ownerId = (request) => request.actorType === "restaurant" ? request.restaurant : request.shipper;
const walletType = (request) => request.actorType === "restaurant" ? "restaurant_balance" : "shipper_earnings";
const transactionType = (request) => request.actorType === "restaurant" ? "restaurant_withdrawal" : "shipper_withdrawal";

const countToday = (actorType, actorId, start, end) => actorType === "restaurant"
  ? withdrawalRepo.countForVietnamDay(actorId, start, end)
  : withdrawalRepo.countForShipperVietnamDay(actorId, start, end);

/** Reserves an eligible wallet amount; the actual debit happens only at Paid. */
const createFor = async ({ actorType, actorId, amount, bankAccountSnapshot }) => runInTransaction(async (session) => {
  const { start, end } = vietnamDayRange();
  if (await countToday(actorType, actorId, start, end) >= MAX_WITHDRAWALS_PER_DAY) {
    throw new AppError(`An account can request at most ${MAX_WITHDRAWALS_PER_DAY} withdrawals per Vietnam day`, 409);
  }
  if (actorType === "shipper") await walletRepo.ensureShipperWallets(actorId, session);
  const draft = actorType === "restaurant"
    ? { actorType, restaurant: actorId, amount, reservedAmount: amount }
    : { actorType, shipper: actorId, amount, reservedAmount: amount };
  draft.bankAccountSnapshot = {
    bankName: bankAccountSnapshot.bankName,
    accountHolder: bankAccountSnapshot.accountHolder,
    accountNumberLast4: bankAccountSnapshot.accountNumberLast4,
    profileUpdatedAt: bankAccountSnapshot.profileUpdatedAt,
  };
  draft.bankAccountSnapshotEncrypted = bankAccountSnapshot.encryptedAccountNumber;
  if (!await reserve(draft, session)) throw new AppError("Insufficient available balance for this withdrawal", 409);
  return withdrawalRepo.create(draft, session);
});

export const createRestaurantWithdrawal = async (user, amount) => {
  const restaurant = await restaurantForOwner(user);
  const bankAccountSnapshot = await restaurantWithdrawalBankAccountSnapshot(user);
  const request = await createFor({ actorType: "restaurant", actorId: restaurant._id, amount, bankAccountSnapshot });
  await recordAudit({ actor: user, action: "withdrawal.requested", targetType: "withdrawal", targetId: request._id, category: "money", metadata: { amount } });
  logger.info({
    event: "withdrawal.requested",
    withdrawalId: request._id,
    actorType: "restaurant",
    actorId: restaurant._id,
    amount,
  }, `Nhà hàng [${restaurant._id}] yêu cầu rút tiền: ${amount} VND (Mã: ${request._id})`);
  return request;
};

export const createShipperWithdrawal = async (user, amount) => {
  const bankAccountSnapshot = await shipperWithdrawalBankAccountSnapshot(user._id);
  const request = await createFor({ actorType: "shipper", actorId: user._id, amount, bankAccountSnapshot });
  logger.info({
    event: "withdrawal.requested",
    withdrawalId: request._id,
    actorType: "shipper",
    actorId: user._id,
    amount,
  }, `Shipper [${user._id}] yêu cầu rút tiền: ${amount} VND (Mã: ${request._id})`);
  return request;
};

export const listRestaurantWithdrawals = async (user) => {
  const restaurant = await restaurantForOwner(user);
  await recordAudit({ actor: user, action: "money.withdrawals_viewed", targetType: "wallet", targetId: restaurant._id, category: "money" });
  return withdrawalRepo.findByRestaurant(restaurant._id);
};

/** Immutable ledger entries are the wallet's transaction history. */
export const listRestaurantWalletTransactions = async (user) => {
  const restaurant = await restaurantForOwner(user);
  await recordAudit({ actor: user, action: "money.transactions_viewed", targetType: "wallet", targetId: restaurant._id, category: "money" });
  return walletRepo.listTransactions({ ownerId: restaurant._id, walletType: "restaurant_balance" });
};

export const listShipperWithdrawals = async (user) => withdrawalRepo.findByShipper(user._id);
export const listAdminWithdrawals = async (status) => withdrawalRepo.findAll(status ? { status } : {});

/** Returns the frozen destination only to an admin actively processing an approved payout. */
export const payoutDetails = async (admin, withdrawalId) => {
  const request = await withdrawalRepo.findById(withdrawalId).select("+bankAccountSnapshotEncrypted");
  if (!request) throw new AppError("Withdrawal request not found", 404);
  if (request.status !== "approved") throw new AppError("Bank details are available only for an approved withdrawal", 409);

  const snapshot = request.bankAccountSnapshot;
  if (!snapshot?.bankName || !snapshot?.accountHolder || !request.bankAccountSnapshotEncrypted) {
    throw new AppError("Withdrawal request has no bank account snapshot", 409);
  }
  const accountNumber = decryptBankAccountNumber(request.bankAccountSnapshotEncrypted);
  await recordAudit({
    actor: admin,
    action: "withdrawal.payout_details_viewed",
    targetType: request.actorType === "restaurant" ? "restaurant" : "user",
    targetId: ownerId(request),
    metadata: { withdrawalId: request._id, accountNumberLast4: snapshot.accountNumberLast4 },
  });
  return {
    bankName: snapshot.bankName,
    accountHolder: snapshot.accountHolder,
    accountNumber,
    accountNumberMasked: `•••• ${snapshot.accountNumberLast4}`,
    profileUpdatedAt: snapshot.profileUpdatedAt || null,
  };
};

export const approveWithdrawal = async (admin, withdrawalId) => runInTransaction(async (session) => {
  const approved = await withdrawalRepo.approve(withdrawalId, admin._id, session);
  if (approved) {
    logger.info({
      event: "withdrawal.approved",
      withdrawalId,
      adminId: admin._id,
      amount: approved.amount,
      actorType: approved.actorType,
    }, `Admin [${admin._id}] DUYỆT yêu cầu rút tiền [${withdrawalId}] (${approved.amount} VND)`);
    return { alreadyApproved: false, request: approved };
  }
  const request = await withdrawalRepo.findById(withdrawalId).session(session);
  if (!request) throw new AppError("Withdrawal request not found", 404);
  if (request.status === "approved") return { alreadyApproved: true, request };
  throw new AppError("Withdrawal request must be pending before approval", 409);
});

/** Releases the reservation from either Pending or Approved without a debit. */
export const rejectWithdrawal = async (admin, withdrawalId, reason) => runInTransaction(async (session) => {
  const request = await withdrawalRepo.findById(withdrawalId).session(session);
  if (!request) throw new AppError("Withdrawal request not found", 404);
  if (request.status === "rejected") return { alreadyRejected: true, request };
  if (!["pending", "approved"].includes(request.status)) throw new AppError("A paid withdrawal cannot be rejected", 409);
  const reservedAmount = request.reservedAmount || request.amount;
  const rejected = await withdrawalRepo.reject(withdrawalId, admin._id, reason, session);
  if (!rejected) throw new AppError("Withdrawal request changed concurrently", 409);
  if (!await release(request, reservedAmount, session)) throw new AppError("Withdrawal reservation is inconsistent", 409);
  logger.info({
    event: "withdrawal.rejected",
    withdrawalId,
    adminId: admin._id,
    reason,
  }, `Admin [${admin._id}] TỪ CHỐI yêu cầu rút tiền [${withdrawalId}], lý do: "${reason}"`);
  return { alreadyRejected: false, request: rejected };
});

/** Records a manual bank transfer and then makes the irreversible wallet debit. */
export const payWithdrawal = async (admin, withdrawalId, bankTransactionReference) => runInTransaction(async (session) => {
  const request = await withdrawalRepo.findById(withdrawalId).session(session);
  if (!request) throw new AppError("Withdrawal request not found", 404);
  if (request.status === "paid") return { alreadyPaid: true, request };
  if (request.status !== "approved") throw new AppError("Withdrawal request must be approved before marking it paid", 409);
  const reservedAmount = request.reservedAmount || request.amount;
  const wallet = await debit(request, reservedAmount, session);
  if (!wallet) throw new AppError("Withdrawal no longer has sufficient reserved balance", 409);
  const transaction = await addLedgerEntry({
    walletType: walletType(request), ownerType: request.actorType, ownerId: ownerId(request),
    amount: -reservedAmount, balanceAfter: wallet.balance, transactionType: transactionType(request),
    eventKey: `withdrawal:${request._id}:paid`, withdrawalId: request._id,
    metadata: { bankTransactionReference, manualPayout: true },
  }, session);
  const paid = await withdrawalRepo.markPaid(withdrawalId, admin._id, bankTransactionReference, session);
  if (!paid) throw new AppError("Withdrawal request changed concurrently", 409);
  logger.info({
    event: "withdrawal.paid",
    withdrawalId,
    adminId: admin._id,
    amount: reservedAmount,
    bankTransactionReference,
  }, `Admin [${admin._id}] XÁC NHẬN CHUYỂN TIỀN thành công cho yêu cầu rút [${withdrawalId}] (${reservedAmount} VND)`);
  return { alreadyPaid: false, request: paid, transaction };
});
