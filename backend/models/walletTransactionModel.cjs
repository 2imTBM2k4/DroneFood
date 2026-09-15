const mongoose = require("mongoose");

// Immutable accounting entry. A unique event key makes financial retries safe.
const walletTransactionSchema = new mongoose.Schema(
  {
    walletType: {
      type: String,
      enum: ["restaurant_balance", "shipper_deposit", "shipper_earnings"],
      required: true,
      index: true,
    },
    ownerType: { type: String, enum: ["restaurant", "shipper"], required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    transactionType: {
      type: String,
      enum: [
        "restaurant_order_settlement",
        "shipper_deposit_top_up",
        "shipper_earnings_top_up",
        "shipper_online_delivery_earnings",
        "shipper_cod_collection",
        "restaurant_withdrawal",
        "shipper_withdrawal",
        "shipper_closure_earnings_offset",
        "shipper_closure_deposit_refund",
      ],
      required: true,
    },
    eventKey: { type: String, required: true, unique: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "WalletPayment", default: null },
    withdrawalId: { type: mongoose.Schema.Types.ObjectId, ref: "RestaurantWithdrawal", default: null },
    closureId: { type: mongoose.Schema.Types.ObjectId, ref: "ShipperAccountClosure", default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.models.WalletTransaction || mongoose.model("WalletTransaction", walletTransactionSchema);
