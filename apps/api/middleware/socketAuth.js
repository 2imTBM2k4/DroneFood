import jwt from "jsonwebtoken";
import User from "../models/userModel.cjs";
import { isTokenVersionCurrent } from "../utils/authTokens.js";

export const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return next(new Error("Authentication required"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === "refresh") return next(new Error("Access token required"));

    const user = await User.findById(decoded.id)
      .select("role restaurantId locked emailVerified +authVersion")
      .lean();
    if (!user || user.emailVerified === false || user.locked || !isTokenVersionCurrent(decoded, user)) {
      return next(new Error("Unauthorized"));
    }

    socket.user = user;
    return next();
  } catch {
    return next(new Error("Unauthorized"));
  }
};
