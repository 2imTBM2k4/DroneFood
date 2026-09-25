import { Restaurant, ShipperProfile } from "../models/index.cjs";
import AppError from "../utils/AppError.js";
import { recordAudit } from "../utils/auditLog.js";
import { encryptBankAccountNumber } from "../utils/bankAccountCrypto.js";

const normalizeAccountNumber = (value) => value.replace(/\s/g, "");

const responseFor = (document) => {
  const account = document?.bankAccount || {};
  return {
    bankName: account.bankName || "",
    accountHolder: account.accountHolder || "",
    accountNumberMasked: account.accountNumberLast4 ? `•••• ${account.accountNumberLast4}` : "",
    updatedAt: account.updatedAt || null,
    isConfigured: Boolean(account.accountNumberLast4),
  };
};

const withdrawalSnapshotFor = (document) => {
  const account = document?.bankAccount || {};
  if (!account.bankName || !account.accountHolder || !account.accountNumberLast4 || !document?.bankAccountEncrypted) {
    throw new AppError("Set a bank account before requesting a withdrawal", 409);
  }
  return {
    bankName: account.bankName,
    accountHolder: account.accountHolder,
    accountNumberLast4: account.accountNumberLast4,
    profileUpdatedAt: account.updatedAt || null,
    encryptedAccountNumber: document.bankAccountEncrypted,
  };
};

const restaurantForOwner = async (user) => {
  const linkedRestaurant = user.restaurantId ? await Restaurant.findById(user.restaurantId).select("+bankAccountEncrypted") : null;
  const restaurant = linkedRestaurant || await Restaurant.findOne({ owner: user._id }).select("+bankAccountEncrypted");
  if (!restaurant) throw new AppError("Restaurant not found", 404);

  const ownerId = String(restaurant.owner?._id || restaurant.owner || "");
  if (user.role !== "admin" && ownerId !== String(user._id) && String(user.restaurantId || "") !== String(restaurant._id)) {
    throw new AppError("You can only manage your own restaurant bank account", 403);
  }
  return restaurant;
};

const save = async ({ actor, model, id, targetType, account }) => {
  const accountNumber = normalizeAccountNumber(account.accountNumber);
  if (accountNumber.length < 6 || accountNumber.length > 24) {
    throw new AppError("Số tài khoản phải có từ 6 đến 24 chữ số", 400);
  }

  const now = new Date();
  const bankAccount = {
    bankName: account.bankName.trim(),
    accountHolder: account.accountHolder.trim(),
    accountNumberLast4: accountNumber.slice(-4),
    updatedAt: now,
  };
  const updated = await model.findByIdAndUpdate(
    id,
    { $set: { bankAccount, bankAccountEncrypted: encryptBankAccountNumber(accountNumber) } },
    { new: true, runValidators: true }
  );
  if (!updated) throw new AppError("Bank account profile not found", 404);

  await recordAudit({
    actor,
    action: "bank_account.updated",
    targetType,
    targetId: updated._id,
    metadata: { bankName: bankAccount.bankName, accountNumberLast4: bankAccount.accountNumberLast4 },
    category: "banking",
  });
  return { success: true, data: responseFor(updated) };
};

export const getShipperBankAccount = async (userId) => {
  const profile = await ShipperProfile.findOne({ user: userId }) || await ShipperProfile.create({ user: userId, vehicleType: "motorbike" });
  return { success: true, data: responseFor(profile) };
};

export const updateShipperBankAccount = async (user, account) => {
  const profile = await ShipperProfile.findOne({ user: user._id }) || await ShipperProfile.create({ user: user._id, vehicleType: "motorbike" });
  return save({ actor: user, model: ShipperProfile, id: profile._id, targetType: "user", account });
};

export const getRestaurantBankAccount = async (user) => {
  const restaurant = await restaurantForOwner(user);
  await recordAudit({ actor: user, action: "bank_account.viewed", targetType: "bank_account", targetId: restaurant._id, category: "banking" });
  return { success: true, data: responseFor(restaurant) };
};

export const updateRestaurantBankAccount = async (user, account) => {
  const restaurant = await restaurantForOwner(user);
  return save({ actor: user, model: Restaurant, id: restaurant._id, targetType: "bank_account", account });
};

export const shipperWithdrawalBankAccountSnapshot = async (userId) => {
  const profile = await ShipperProfile.findOne({ user: userId }).select("+bankAccountEncrypted");
  if (!profile) throw new AppError("Set a bank account before requesting a withdrawal", 409);
  return withdrawalSnapshotFor(profile);
};

export const restaurantWithdrawalBankAccountSnapshot = async (user) => {
  const restaurant = await restaurantForOwner(user);
  return withdrawalSnapshotFor(restaurant);
};
