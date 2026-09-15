import crypto from "crypto";
import AppError from "./AppError.js";

const ALGORITHM = "aes-256-gcm";

const encryptionKey = () => {
  const configured = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
  if (!configured) throw new AppError("Bank account encryption is not configured", 503);

  const key = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (key.length !== 32) throw new AppError("Bank account encryption is not configured", 503);
  return key;
};

export const encryptBankAccountNumber = (accountNumber) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(accountNumber, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
};
