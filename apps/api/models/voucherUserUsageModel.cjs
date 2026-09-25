const mongoose = require("mongoose");

// Counter per customer and voucher. Keeping it separate avoids an unbounded
// usage array on Voucher and lets the database enforce concurrent per-user
// reservations atomically.
const voucherUserUsageSchema = new mongoose.Schema(
  {
    voucher: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    activeCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

voucherUserUsageSchema.index({ voucher: 1, user: 1 }, { unique: true });

module.exports = mongoose.models.VoucherUserUsage || mongoose.model("VoucherUserUsage", voucherUserUsageSchema);
