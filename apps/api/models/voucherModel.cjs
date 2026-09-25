const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema(
  {
    // Stored normalized so every client sees and submits one canonical code.
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 32,
      unique: true,
    },
    kind: {
      type: String,
      enum: ["fixed", "percent"],
      required: true,
    },
    value: { type: Number, required: true, min: 1 },
    appliesTo: {
      type: String,
      enum: ["items_subtotal", "shipping_fee"],
      required: true,
    },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    // Required for percentage vouchers; fixed vouchers are inherently capped
    // by their face value and the target amount.
    maxDiscountAmount: { type: Number, default: null, min: 1 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    totalQuota: { type: Number, required: true, min: 1 },
    perUserQuota: { type: Number, required: true, min: 1 },
    usageCount: { type: Number, default: 0, min: 0 },
    enabled: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

voucherSchema.pre("validate", function validateVoucher(next) {
  if (this.endsAt <= this.startsAt) {
    this.invalidate("endsAt", "endsAt must be after startsAt");
  }
  if (this.kind === "percent") {
    if (!Number.isInteger(this.value) || this.value > 100) {
      this.invalidate("value", "Percentage value must be an integer from 1 to 100");
    }
    if (!this.maxDiscountAmount) {
      this.invalidate("maxDiscountAmount", "Percentage vouchers require a maximum discount");
    }
  } else if (!Number.isInteger(this.value)) {
    this.invalidate("value", "Fixed voucher value must be whole VND");
  }
  if (this.perUserQuota > this.totalQuota) {
    this.invalidate("perUserQuota", "perUserQuota cannot exceed totalQuota");
  }
  next();
});

voucherSchema.index({ enabled: 1, startsAt: 1, endsAt: 1 });

module.exports = mongoose.models.Voucher || mongoose.model("Voucher", voucherSchema);
