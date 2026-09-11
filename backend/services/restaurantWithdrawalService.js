import AppError from "../utils/AppError.js";
import * as restaurantRepo from "../repositories/restaurantRepository.js";
import * as withdrawalRepo from "../repositories/restaurantWithdrawalRepository.js";
import * as walletRepo from "../repositories/walletRepository.js";
import { addLedgerEntry, runInTransaction } from "./walletService.js";

const vietnamDayRange = (date = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

/** Resolves the caller's restaurant without trusting an ID from the client. */
const restaurantForOwner = async (user) => {
  const restaurant = user.restaurantId
    ? await restaurantRepo.findById(user.restaurantId)
    : await restaurantRepo.findByOwner(user._id);
  if (!restaurant) throw new AppError("Restaurant not found", 404);
  const ownerId = String(restaurant.owner?._id || restaurant.owner);
  if (ownerId !== String(user._id)) throw new AppError("Unauthorized: Not your restaurant", 403);
  return restaurant;
};

/** Creates a withdrawal request after enforcing the Vietnam-day request limit. */
export const createWithdrawal = async (user, amount) => {
  const restaurant = await restaurantForOwner(user);
  const { start, end } = vietnamDayRange();
  const todayCount = await withdrawalRepo.countForVietnamDay(restaurant._id, start, end);
  if (todayCount >= 3) throw new AppError("A restaurant can request at most 3 withdrawals per Vietnam day", 409);
  return withdrawalRepo.create({ restaurant: restaurant._id, amount });
};

export const listWithdrawals = async (user) => {
  const restaurant = await restaurantForOwner(user);
  return withdrawalRepo.findByRestaurant(restaurant._id);
};

/** Simulates a confirmed payout callback and debits the restaurant exactly once. */
export const completeWithdrawal = async (actor, withdrawalId) => runInTransaction(async (session) => {
  const request = await withdrawalRepo.findById(withdrawalId).session(session);
  if (!request) throw new AppError("Withdrawal request not found", 404);
  if (request.status === "approved") return { alreadyCompleted: true, request };

  const restaurant = await walletRepo.updateRestaurantBalance(request.restaurant, -request.amount, session);
  if (!restaurant) throw new AppError("Restaurant has insufficient available balance", 409);
  const transaction = await addLedgerEntry({
    walletType: "restaurant_balance",
    ownerType: "restaurant",
    ownerId: request.restaurant,
    amount: -request.amount,
    balanceAfter: restaurant.balance,
    transactionType: "restaurant_withdrawal",
    eventKey: `restaurant-withdrawal:${request._id}`,
    withdrawalId: request._id,
    metadata: { simulatedPayout: true },
  }, session);
  const approved = await withdrawalRepo.approve(request._id, actor._id, session);
  if (!approved) throw new AppError("Withdrawal request changed concurrently", 409);
  return { alreadyCompleted: false, request: approved, transaction };
});

export { vietnamDayRange };
