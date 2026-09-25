const mongoose = require("mongoose");

// Earnings may be negative because COD collections are settled against it.
const shipperEarningsWalletSchema = new mongoose.Schema(
  {
    shipper: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    balance: { type: Number, required: true, default: 0 },
    // COD exposure is reserved before pickup but is not part of the balance.
    reservedCodLiability: { type: Number, required: true, default: 0, min: 0 },
    // Withdrawal requests hold earnings until an admin records a paid transfer.
    // This is excluded from both withdrawal availability and COD capacity.
    reservedWithdrawalAmount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.ShipperEarningsWallet || mongoose.model("ShipperEarningsWallet", shipperEarningsWalletSchema);
