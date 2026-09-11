const mongoose = require("mongoose");

const walletPaymentSchema = new mongoose.Schema(
  {
    shipper: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    vnpTxnRef: { type: String, required: true, unique: true },
    vnpTransactionNo: { type: String, default: null },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending", index: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.WalletPayment || mongoose.model("WalletPayment", walletPaymentSchema);
