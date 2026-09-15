import mongoose from "mongoose";
import * as addressBookRepo from "../repositories/addressBookRepository.js";
import AppError from "../utils/AppError.js";

const MAX_ADDRESS_ENTRIES = 5;

const assertEntryId = (entryId) => {
  if (!mongoose.isValidObjectId(entryId)) throw new AppError("Address entry ID is invalid", 400);
};

const serialise = (entry, fullName = "") => ({
  id: String(entry._id),
  label: entry.label,
  // Orders retain their own shipping snapshot; saved addresses deliberately
  // render the current account fullname instead of owning a second name.
  recipient: fullName || entry.recipient,
  phone: entry.phone,
  address: entry.address,
  city: entry.city,
  state: entry.state,
  country: entry.country,
  zipCode: entry.zipCode || "",
  lat: entry.lat,
  lng: entry.lng,
  isDefault: Boolean(entry.isDefault),
});

export const listAddressBook = async (userId) => {
  const user = await addressBookRepo.findForUser(userId);
  if (!user) throw new AppError("User not found", 404);
  return { success: true, data: (user.addressBook || []).map((entry) => serialise(entry, user.name)) };
};

export const createAddressEntry = async (userId, data) => {
  const session = await mongoose.startSession();
  let entry;
  let fullName = "";
  try {
    await session.withTransaction(async () => {
      const user = await addressBookRepo.findForUser(userId, { session });
      if (!user) throw new AppError("User not found", 404);
      if (user.addressBook.length >= MAX_ADDRESS_ENTRIES) {
        throw new AppError(`You can save up to ${MAX_ADDRESS_ENTRIES} delivery addresses`, 409);
      }
      const makeDefault = data.isDefault === true || user.addressBook.length === 0;
      if (makeDefault) user.addressBook.forEach((item) => { item.isDefault = false; });
      fullName = user.name || data.recipient || "Customer";
      user.addressBook.push({ ...data, recipient: fullName, isDefault: makeDefault });
      entry = user.addressBook.at(-1);
      await addressBookRepo.save(user, { session });
    });
  } finally {
    await session.endSession();
  }
  return { success: true, data: serialise(entry, fullName) };
};

export const updateAddressEntry = async (userId, entryId, data) => {
  assertEntryId(entryId);
  const user = await addressBookRepo.updateNonDefault(userId, entryId, data);
  if (!user) throw new AppError("Address entry not found", 404);
  const entry = user.addressBook.id(entryId);
  return { success: true, data: serialise(entry, user.name) };
};

export const setDefaultAddressEntry = async (userId, entryId) => {
  assertEntryId(entryId);
  const user = await addressBookRepo.setDefault(userId, entryId);
  if (!user) throw new AppError("Address entry not found", 404);
  return { success: true, data: user.addressBook.map((entry) => serialise(entry, user.name)) };
};

export const deleteAddressEntry = async (userId, entryId) => {
  assertEntryId(entryId);
  const current = await addressBookRepo.findForUser(userId);
  if (!current) throw new AppError("User not found", 404);
  const target = current.addressBook.id(entryId);
  if (!target) throw new AppError("Address entry not found", 404);
  if (target.isDefault) throw new AppError("The default address must be changed before deletion", 409);
  const user = await addressBookRepo.removeNonDefault(userId, entryId);
  if (!user) throw new AppError("Address entry not found", 404);
  return { success: true, data: user.addressBook.map((entry) => serialise(entry, user.name)) };
};

// Used by quote/order services. It returns a plain snapshot, never a live
// reference to the subdocument.
export const resolveAddressSnapshot = async (userId, entryId) => {
  assertEntryId(entryId);
  const user = await addressBookRepo.findForUser(userId);
  if (!user) throw new AppError("User not found", 404);
  const entry = user.addressBook.id(entryId);
  if (!entry) throw new AppError("Address entry not found", 404);
  return {
    fullName: user.name || entry.recipient,
    phone: entry.phone,
    address: entry.address,
    city: entry.city,
    state: entry.state,
    country: entry.country,
    zipCode: entry.zipCode || "",
    lat: entry.lat,
    lng: entry.lng,
  };
};
