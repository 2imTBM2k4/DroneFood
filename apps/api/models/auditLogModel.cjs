const mongoose = require("mongoose");

// TODO: Archive to cold storage before TTL expiry for compliance categories
const RETENTION_DAYS_BY_CATEGORY = {
  money: 1825,
  banking: 1825,
  access: 730,
  security: 730,
  password: 730,
  operations: 180,
  authentication: 90,
  email: 90,
};

function defaultExpiresAt() {
  const category = this.category || "operations";
  const days = RETENTION_DAYS_BY_CATEGORY[category] || 180;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * An append-only trail of privileged actions — who did what, to which record,
 * and why. Real platforms treat this as non-negotiable: without it a staff
 * member can quietly cancel orders, flip roles or mark an order delivered with
 * no way to trace it afterwards.
 *
 * Entries are never updated or deleted by the application.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Copied at write time so the trail still reads correctly if the account
    // is later renamed or removed.
    actorEmail: { type: String, default: "" },
    actorRole: { type: String, default: "" },
    category: { type: String, enum: ["authentication", "email", "password", "banking", "money", "access", "security", "operations"], default: "operations" },
    outcome: { type: String, enum: ["success", "failure"], default: "success" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },

    // Dotted verb describing the action, e.g. "order.status_changed".
    action: { type: String, required: true },

    targetType: {
      type: String,
      enum: ["user", "restaurant", "merchant", "branch", "hub", "order", "food", "drone", "authentication", "bank_account", "wallet", "refund", "withdrawal"],
      required: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      default: null,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    occurredAt: { type: Date, default: Date.now },

    // Required for anything destructive or overriding — the UI collects it.
    reason: { type: String, default: "" },

    // Free-form context: previous/next values, amounts, etc.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    // TTL expiry date: automatically cleaned up by MongoDB background TTL thread
    expiresAt: {
      type: Date,
      default: defaultExpiresAt,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index: MongoDB automatically purges expired records
auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes optimized for query patterns and sorting
auditLogSchema.index({ createdAt: -1, category: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ merchantId: 1, occurredAt: -1 });
auditLogSchema.index({ branchId: 1, occurredAt: -1 });

module.exports =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
