import crypto from "crypto";
import AppError from "../utils/AppError.js";
import sendEmail from "../utils/sendEmail.js";
import { User, ShipperProfile } from "../models/index.cjs";
import * as closureRepo from "../repositories/shipperAccountClosureRepository.js";
import * as walletRepo from "../repositories/walletRepository.js";
import { addLedgerEntry, runInTransaction } from "./walletService.js";

const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const sendBankDetailsEmail = async (email, token) => {
  const baseUrl = process.env.SHIPPER_CLOSURE_FORM_URL || `${process.env.FRONTEND_URL || "http://localhost:5173"}/shipper/closure-bank-details`;
  const url = `${baseUrl}?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: "Cập nhật tài khoản nhận ký quỹ DroneFood",
    html: `<p>Vui lòng cập nhật lại thông tin tài khoản nhận ký quỹ tại <a href="${url}">đây</a>.</p>`,
  });
};

/** Locks a shipper immediately and starts the manual account-closing review. */
export const requestClosure = async (shipperId, bankDetails) => runInTransaction(async (session) => {
  const shipper = await User.findOne({ _id: shipperId, role: "shipper" }).session(session);
  if (!shipper) throw new AppError("Shipper not found", 404);
  const existing = await closureRepo.findByShipper(shipperId).session(session);
  if (existing) throw new AppError("An account closure request already exists", 409);
  const rawToken = crypto.randomBytes(32).toString("hex");
  const closure = await closureRepo.create({
    shipper: shipper._id,
    ...bankDetails,
    formTokenHash: tokenHash(rawToken),
    formTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }, session);
  await User.updateOne({ _id: shipper._id }, { $set: { locked: true } }, { session });
  await ShipperProfile.updateOne({ user: shipper._id }, { $set: { status: "offline" } }, { session });
  return { closure, rawToken, email: shipper.email };
});

/** Sends a fresh one-time bank-details form link to a locked shipper. */
export const sendBankDetailsForm = async (closureId) => {
  const closure = await closureRepo.findById(closureId).populate("shipper", "email");
  if (!closure) throw new AppError("Account closure request not found", 404);
  if (closure.status === "approved") throw new AppError("Account closure is already approved", 409);
  const rawToken = crypto.randomBytes(32).toString("hex");
  closure.formTokenHash = tokenHash(rawToken);
  closure.formTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await closure.save();
  await sendBankDetailsEmail(closure.shipper.email, rawToken);
  return closure;
};

/** Updates bank details through the short-lived email form token. */
export const updateBankDetails = async (token, bankDetails) => {
  const closure = await closureRepo.findByTokenHash(tokenHash(token));
  if (!closure) throw new AppError("The bank details form is invalid or expired", 400);
  if (closure.status === "approved") throw new AppError("Account closure is already approved", 409);
  Object.assign(closure, bankDetails);
  closure.formTokenHash = null;
  closure.formTokenExpiresAt = null;
  await closure.save();
  return closure;
};

/** Offsets negative earnings against deposit and records the manual refund amount. */
export const approveClosure = async (actor, closureId) => runInTransaction(async (session) => {
  const closure = await closureRepo.findById(closureId).session(session);
  if (!closure) throw new AppError("Account closure request not found", 404);
  if (closure.status === "approved") return { alreadyCompleted: true, closure };

  await walletRepo.ensureShipperWallets(closure.shipper, session);
  const { deposit, earnings } = await walletRepo.getShipperWallets(closure.shipper, session);
  const deficit = Math.max(0, -earnings.balance);
  if (deficit > deposit.balance) throw new AppError("Deposit cannot cover the shipper earnings deficit", 409);

  if (deficit > 0) {
    const offsetEarnings = await walletRepo.updateEarningsBalance(closure.shipper, deficit, session);
    await addLedgerEntry({
      walletType: "shipper_earnings", ownerType: "shipper", ownerId: closure.shipper,
      amount: deficit, balanceAfter: offsetEarnings.balance,
      transactionType: "shipper_closure_earnings_offset", eventKey: `closure:${closure._id}:earnings-offset`,
      closureId: closure._id, metadata: { manualClosure: true },
    }, session);
    const offsetDeposit = await walletRepo.updateDepositBalance(closure.shipper, -deficit, session);
    await addLedgerEntry({
      walletType: "shipper_deposit", ownerType: "shipper", ownerId: closure.shipper,
      amount: -deficit, balanceAfter: offsetDeposit.balance,
      transactionType: "shipper_closure_earnings_offset", eventKey: `closure:${closure._id}:deposit-offset`,
      closureId: closure._id, metadata: { manualClosure: true },
    }, session);
  }

  const current = await walletRepo.getShipperWallets(closure.shipper, session);
  const refundAmount = current.deposit.balance;
  if (refundAmount > 0) {
    const refundedDeposit = await walletRepo.updateDepositBalance(closure.shipper, -refundAmount, session);
    await addLedgerEntry({
      walletType: "shipper_deposit", ownerType: "shipper", ownerId: closure.shipper,
      amount: -refundAmount, balanceAfter: refundedDeposit.balance,
      transactionType: "shipper_closure_deposit_refund", eventKey: `closure:${closure._id}:deposit-refund`,
      closureId: closure._id, metadata: { manualPayout: true },
    }, session);
  }

  closure.status = "approved";
  closure.approvedAt = new Date();
  closure.approvedBy = actor._id;
  await closure.save({ session });
  return { alreadyCompleted: false, closure, refundAmount };
});

export { sendBankDetailsEmail };
