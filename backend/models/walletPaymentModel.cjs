const mongoose = require("mongoose");

const walletPaymentSchema = new mongoose.Schema(
  {
    shipper: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    // VNPay fields are retained only to reconcile historic top-ups.
    vnpTxnRef: { type: String, default: undefined, unique: true, sparse: true },
    vnpTransactionNo: { type: String, default: null },
    paymentProvider: { type: String, enum: ["VNPAY", "PAYOS"], default: "VNPAY", required: true },
    payosOrderCode: { type: Number, default: undefined, unique: true, sparse: true },
    payosPaymentLinkId: { type: String, default: null },
    payosReference: { type: String, default: null },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending", index: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.WalletPayment || mongoose.model("WalletPayment", walletPaymentSchema);
