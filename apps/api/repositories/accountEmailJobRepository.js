import { AccountEmailJob } from "../models/index.cjs";

export const enqueue = ({
  event,
  userId,
  to,
  subject,
  html,
  idempotencyKey,
  status = "queued",
  resetTokenHash = null,
  resetTokenExpiresAt = null,
  verificationTokenHash = null,
  verificationTokenExpiresAt = null,
  verificationPurpose = null,
  reconcileAfter = null,
}) => AccountEmailJob.findOneAndUpdate(
  { idempotencyKey },
  {
    $setOnInsert: {
      event,
      userId,
      to,
      subject,
      html,
      idempotencyKey,
      status,
      resetTokenHash,
      resetTokenExpiresAt,
      verificationTokenHash,
      verificationTokenExpiresAt,
      verificationPurpose,
      reconcileAfter,
      availableAt: new Date(),
    },
  },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

export const activatePendingVerification = (jobId, verificationTokenHash) => AccountEmailJob.updateOne(
  { _id: jobId, status: "pending", verificationTokenHash },
  { $set: { status: "queued", availableAt: new Date() } }
);

export const cancelPendingVerification = (jobId, verificationTokenHash) => AccountEmailJob.updateOne(
  { _id: jobId, status: "pending", verificationTokenHash },
  { $set: { status: "cancelled", availableAt: new Date() } }
);

export const postponePendingVerification = (jobId, verificationTokenHash, reconcileAfter) => AccountEmailJob.updateOne(
  { _id: jobId, status: "pending", verificationTokenHash },
  { $set: { reconcileAfter } }
);

export const recoverVerificationJob = (jobId, verificationTokenHash) => AccountEmailJob.updateOne(
  { _id: jobId, status: { $in: ["pending", "cancelled"] }, verificationTokenHash },
  { $set: { status: "queued", availableAt: new Date(), lockedAt: null } }
);

export const findVerificationJobState = (jobId, verificationTokenHash) => AccountEmailJob.findOne({
  _id: jobId,
  verificationTokenHash,
}).select("status");

export const activatePending = (jobId, resetTokenHash) => AccountEmailJob.updateOne(
  { _id: jobId, status: "pending", resetTokenHash },
  { $set: { status: "queued", availableAt: new Date() } }
);

export const cancelPending = (jobId, resetTokenHash) => AccountEmailJob.updateOne(
  { _id: jobId, status: "pending", resetTokenHash },
  { $set: { status: "cancelled", availableAt: new Date() } }
);

export const postponePending = (jobId, resetTokenHash, reconcileAfter) => AccountEmailJob.updateOne(
  { _id: jobId, status: "pending", resetTokenHash },
  { $set: { reconcileAfter } }
);

export const recoverResetJob = (jobId, resetTokenHash) => AccountEmailJob.updateOne(
  { _id: jobId, status: { $in: ["pending", "cancelled"] }, resetTokenHash },
  { $set: { status: "queued", availableAt: new Date(), lockedAt: null } }
);

export const findResetJobState = (jobId, resetTokenHash) => AccountEmailJob.findOne({
  _id: jobId,
  resetTokenHash,
}).select("status");

export const listPendingPasswordResets = (limit = 20, now = new Date()) => AccountEmailJob.find({
  event: "password.reset_requested",
  status: "pending",
  reconcileAfter: { $ne: null, $lte: now },
})
  .sort({ createdAt: 1 })
  .limit(limit)
  .select("userId createdAt reconcileAfter +resetTokenHash +resetTokenExpiresAt");

export const listPendingVerifications = (limit = 20, now = new Date()) => AccountEmailJob.find({
  event: { $in: ["email.verification_requested", "email.change_verification_requested"] },
  status: "pending",
  reconcileAfter: { $ne: null, $lte: now },
})
  .sort({ createdAt: 1 })
  .limit(limit)
  .select("event userId createdAt reconcileAfter +verificationTokenHash +verificationTokenExpiresAt +verificationPurpose");

export const recoverStale = (lockedBefore) => AccountEmailJob.updateMany(
  { status: "processing", lockedAt: { $lt: lockedBefore } },
  { $set: { status: "queued", lockedAt: null, availableAt: new Date() } }
);

export const claimNext = () => AccountEmailJob.findOneAndUpdate(
  {
    status: { $in: ["queued", "failed"] },
    availableAt: { $lte: new Date() },
    $expr: { $lt: ["$attempts", "$maxAttempts"] },
  },
  {
    $set: { status: "processing", lockedAt: new Date() },
    $inc: { attempts: 1 },
  },
  { new: true, sort: { availableAt: 1, createdAt: 1 } }
).select("event userId attempts maxAttempts +to +subject +html +resetTokenHash +verificationTokenHash +verificationPurpose");

export const markSent = (jobId) => AccountEmailJob.updateOne(
  { _id: jobId, status: "processing" },
  { $set: { status: "sent", sentAt: new Date(), lockedAt: null, lastErrorCode: "" } }
);

export const markFailed = (jobId, { errorCode, availableAt }) => AccountEmailJob.updateOne(
  { _id: jobId, status: "processing" },
  {
    $set: {
      status: "failed",
      lockedAt: null,
      lastErrorCode: errorCode,
      availableAt,
    },
  }
);

export const markCancelled = (jobId, errorCode = "STALE_RESET_TOKEN") => AccountEmailJob.updateOne(
  { _id: jobId, status: "processing" },
  {
    $set: {
      status: "cancelled",
      lockedAt: null,
      lastErrorCode: errorCode,
    },
  }
);

export const initializeIndexes = () => AccountEmailJob.init();
