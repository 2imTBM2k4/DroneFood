const mongoose = require("mongoose");

const accountEmailJobSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // These fields may contain an account address or a one-time reset link.
    // Keep them excluded from ordinary queries and never write them to logs.
    to: { type: String, required: true, select: false },
    subject: { type: String, required: true, select: false },
    html: { type: String, required: true, select: false },
    idempotencyKey: { type: String, required: true, unique: true, select: false },
    // Present only while a password-reset email is waiting for the matching
    // User reset token to be persisted. It is a SHA-256 digest, never the raw
    // token that appears in the email link.
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpiresAt: { type: Date, default: null, select: false },
    verificationTokenHash: { type: String, default: null, select: false },
    verificationTokenExpiresAt: { type: Date, default: null, select: false },
    verificationPurpose: {
      type: String,
      enum: ["registration", "email_change", null],
      default: null,
      select: false,
    },
    // Pending reset jobs are intentionally invisible to reconciliation until
    // the request has had time to persist and activate the matching User token.
    reconcileAfter: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: ["pending", "queued", "processing", "sent", "failed", "cancelled"],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1 },
    availableAt: { type: Date, default: Date.now, index: true },
    lockedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    lastErrorCode: { type: String, default: "" },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

accountEmailJobSchema.index({ status: 1, availableAt: 1, createdAt: 1 });
accountEmailJobSchema.index({ status: 1, reconcileAfter: 1, createdAt: 1 });

module.exports = mongoose.models.AccountEmailJob || mongoose.model("AccountEmailJob", accountEmailJobSchema);
