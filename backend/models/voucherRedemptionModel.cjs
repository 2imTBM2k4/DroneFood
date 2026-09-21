const mongoose = require("mongoose");

const voucherRedemptionSchema = new mongoose.Schema(
  {
    voucher: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // The compound unique index below is also prefix-searchable by order.
    // Do not recreate the old order-only index: it prevented voucher stacking.
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    discountAmount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["reserved", "released"], default: "reserved", index: true },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, default: "" },
  },
  { timestamps: true }
);

voucherRedemptionSchema.index({ order: 1, voucher: 1 }, { unique: true });
voucherRedemptionSchema.index({ voucher: 1, user: 1, status: 1 });

module.exports = mongoose.models.VoucherRedemption || mongoose.model("VoucherRedemption", voucherRedemptionSchema);
