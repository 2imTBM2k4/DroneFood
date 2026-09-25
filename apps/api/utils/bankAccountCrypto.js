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

export const decryptBankAccountNumber = (encrypted) => {
  try {
    const [version, ivValue, tagValue, ciphertextValue] = String(encrypted).split(":");
    if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("Invalid bank account ciphertext");
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivValue, "base64"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Withdrawal bank account snapshot cannot be decrypted", 409);
  }
};
