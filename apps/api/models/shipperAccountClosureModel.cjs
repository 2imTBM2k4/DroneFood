const mongoose = require("mongoose");

const shipperAccountClosureSchema = new mongoose.Schema(
  {
    shipper: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    bankName: { type: String, required: true, trim: true },
    accountHolder: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending_reconciliation", "approved"], default: "pending_reconciliation" },
    formTokenHash: { type: String, default: null, select: false },
    formTokenExpiresAt: { type: Date, default: null, select: false },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.ShipperAccountClosure || mongoose.model("ShipperAccountClosure", shipperAccountClosureSchema);
