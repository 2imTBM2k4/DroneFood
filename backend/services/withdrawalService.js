import AppError from "../utils/AppError.js";
import * as restaurantRepo from "../repositories/restaurantRepository.js";
import * as withdrawalRepo from "../repositories/restaurantWithdrawalRepository.js";
import * as walletRepo from "../repositories/walletRepository.js";
import { addLedgerEntry, runInTransaction } from "./walletService.js";

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
const createFor = async ({ actorType, actorId, amount }) => runInTransaction(async (session) => {
  const { start, end } = vietnamDayRange();
  if (await countToday(actorType, actorId, start, end) >= MAX_WITHDRAWALS_PER_DAY) {
    throw new AppError(`An account can request at most ${MAX_WITHDRAWALS_PER_DAY} withdrawals per Vietnam day`, 409);
  }
  if (actorType === "shipper") await walletRepo.ensureShipperWallets(actorId, session);
  const draft = actorType === "restaurant"
    ? { actorType, restaurant: actorId, amount, reservedAmount: amount }
    : { actorType, shipper: actorId, amount, reservedAmount: amount };
  if (!await reserve(draft, session)) throw new AppError("Insufficient available balance for this withdrawal", 409);
  return withdrawalRepo.create(draft, session);
});

export const createRestaurantWithdrawal = async (user, amount) => {
  const restaurant = await restaurantForOwner(user);
  return createFor({ actorType: "restaurant", actorId: restaurant._id, amount });
};

export const createShipperWithdrawal = async (user, amount) =>
  createFor({ actorType: "shipper", actorId: user._id, amount });

export const listRestaurantWithdrawals = async (user) => {
  const restaurant = await restaurantForOwner(user);
  return withdrawalRepo.findByRestaurant(restaurant._id);
};

export const listShipperWithdrawals = async (user) => withdrawalRepo.findByShipper(user._id);
export const listAdminWithdrawals = async (status) => withdrawalRepo.findAll(status ? { status } : {});

export const approveWithdrawal = async (admin, withdrawalId) => runInTransaction(async (session) => {
  const approved = await withdrawalRepo.approve(withdrawalId, admin._id, session);
  if (approved) return { alreadyApproved: false, request: approved };
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
  return { alreadyPaid: false, request: paid, transaction };
});
