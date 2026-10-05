import jwt from "jsonwebtoken";

export const currentAuthVersion = (value) => Number.isInteger(Number(value))
  ? Number(value)
  : 0;

export const createAccessToken = (user) => jwt.sign(
  {
    id: String(user._id || user.id || user),
    type: "access",
    authVersion: currentAuthVersion(user.authVersion),
  },
  process.env.JWT_SECRET,
  { expiresIn: "30m" }
);

export const createRefreshToken = (user) => jwt.sign(
  {
    id: String(user._id || user.id || user),
    type: "refresh",
    authVersion: currentAuthVersion(user.authVersion),
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

// Tokens issued before authVersion existed implicitly belong to version zero,
// preserving existing sessions until the first password change/reset.
export const isTokenVersionCurrent = (decoded, user) =>
  currentAuthVersion(decoded?.authVersion) === currentAuthVersion(user?.authVersion);
