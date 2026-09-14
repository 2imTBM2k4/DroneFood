const mongoose = require("mongoose");

const shipperDepositSchema = new mongoose.Schema(
  {
    shipper: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    balance: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.ShipperDeposit || mongoose.model("ShipperDeposit", shipperDepositSchema);
