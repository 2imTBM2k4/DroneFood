import { ExpoPushToken } from "../models/index.cjs";

export const upsertForUser = (userId, token, platform) => ExpoPushToken.findOneAndUpdate(
  { token },
  { $set: { user: userId, platform, lastSeenAt: new Date() } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

export const removeForUser = (userId, token) => ExpoPushToken.deleteOne({ user: userId, token });
export const listForUser = (userId) => ExpoPushToken.find({ user: userId }).select("token").lean();
export const removeTokens = (tokens) => ExpoPushToken.deleteMany({ token: { $in: tokens } });
