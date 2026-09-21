const mongoose = require("mongoose");

// This is the platform-side counter-ledger for a customer payment covered in
// full by vouchers. It intentionally does not alter restaurant or shipper
// balances: those parties settle from the gross checkout snapshot.
const platformVoucherFundingLedgerSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true, immutable: true },
    eventKey: { type: String, required: true, unique: true, immutable: true },
    amount: { type: Number, required: true, min: 1, immutable: true },
    currency: { type: String, enum: ["VND"], default: "VND", required: true, immutable: true },
    counterparty: {
      restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, immutable: true },
      restaurantPayoutAmount: { type: Number, required: true, min: 0, immutable: true },
      shipper: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, immutable: true },
      shipperPayoutAmount: { type: Number, required: true, min: 0, immutable: true },
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.models.PlatformVoucherFundingLedger || mongoose.model("PlatformVoucherFundingLedger", platformVoucherFundingLedgerSchema);
