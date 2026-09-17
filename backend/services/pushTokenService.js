import AppError from "../utils/AppError.js";
import * as repo from "../repositories/expoPushTokenRepository.js";

const isExpoPushToken = (token) => /^(?:Expo|Exponent)PushToken\[[^\]\s]{1,220}\]$/.test(token);

export const register = async (user, { token, platform }) => {
  if (!isExpoPushToken(token)) throw new AppError("Invalid Expo push token", 400);
  if (!["android", "ios"].includes(platform)) throw new AppError("Invalid push platform", 400);
  await repo.upsertForUser(user._id, token, platform);
  return { registered: true };
};

export const unregister = async (user, { token }) => {
  if (!isExpoPushToken(token)) throw new AppError("Invalid Expo push token", 400);
  await repo.removeForUser(user._id, token);
  return { unregistered: true };
};
