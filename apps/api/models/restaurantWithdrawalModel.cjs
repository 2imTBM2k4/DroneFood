const mongoose = require("mongoose");

const restaurantWithdrawalSchema = new mongoose.Schema(
  {
    // This model name is retained for collection compatibility. It stores
    // manual withdrawal requests for both restaurants and shippers.
    actorType: { type: String, enum: ["restaurant", "shipper"], default: "restaurant", required: true, index: true },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
      required() { return this.actorType === "restaurant"; },
      index: true,
    },
    shipper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      required() { return this.actorType === "shipper"; },
      index: true,
    },
    amount: { type: Number, required: true, min: 500000 },
    reservedAmount: { type: Number, required: true, min: 0 },
    // Payment destination is frozen at request time. A later Profile edit
    // must never redirect an already pending or approved withdrawal.
    bankAccountSnapshot: {
      bankName: { type: String, required: true },
      accountHolder: { type: String, required: true },
      accountNumberLast4: { type: String, required: true },
      profileUpdatedAt: { type: Date, default: null },
    },
    bankAccountSnapshotEncrypted: { type: String, required: true, select: false, immutable: true },
    status: { type: String, enum: ["pending", "approved", "paid", "rejected"], default: "pending", index: true },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, trim: true, maxlength: 300, default: null },
    paidAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    bankTransactionReference: { type: String, trim: true, maxlength: 160, default: null },
  },
  { timestamps: true }
);

restaurantWithdrawalSchema.set("toJSON", {
  transform: (_document, result) => {
    delete result.bankAccountSnapshotEncrypted;
    return result;
  },
});

restaurantWithdrawalSchema.index({ restaurant: 1, createdAt: -1 });
restaurantWithdrawalSchema.index({ shipper: 1, createdAt: -1 });

module.exports = mongoose.models.RestaurantWithdrawal || mongoose.model("RestaurantWithdrawal", restaurantWithdrawalSchema);
