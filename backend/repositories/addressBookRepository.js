import mongoose from "mongoose";
import { User } from "../models/index.cjs";

const addressBookSelect = "addressBook";

export const findForUser = async (userId, options = {}) =>
  User.findById(userId).select(addressBookSelect).session(options.session || null);

export const save = async (user, options = {}) => user.save(options);

export const updateNonDefault = async (userId, entryId, updates) =>
  User.findOneAndUpdate(
    { _id: userId, "addressBook._id": entryId },
    { $set: Object.fromEntries(Object.entries(updates).map(([key, value]) => [`addressBook.$.${key}`, value])) },
    { new: true, runValidators: true },
  ).select(addressBookSelect);

export const removeNonDefault = async (userId, entryId) =>
  User.findOneAndUpdate(
    { _id: userId, addressBook: { $elemMatch: { _id: entryId, isDefault: { $ne: true } } } },
    { $pull: { addressBook: { _id: entryId } } },
    { new: true },
  ).select(addressBookSelect);

export const setDefault = async (userId, entryId) =>
  User.findOneAndUpdate(
    { _id: userId, "addressBook._id": entryId },
    [{
      $set: {
        addressBook: {
          $map: {
            input: "$addressBook",
            as: "entry",
            in: { $mergeObjects: ["$$entry", { isDefault: { $eq: ["$$entry._id", new mongoose.Types.ObjectId(entryId)] } }] },
          },
        },
      },
    }],
    { new: true },
  ).select(addressBookSelect);
