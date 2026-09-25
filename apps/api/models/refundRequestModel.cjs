const mongoose = require("mongoose");

const refundRequestSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    bank: {
      bankName: { type: String, required: true, trim: true, maxlength: 100 },
      accountHolder: { type: String, required: true, trim: true, maxlength: 120 },
      accountNumberLast4: { type: String, default: "", maxlength: 4 },
      // Retained only so the explicit migration can read old documents. New
      // refund requests never write this field, and normal queries exclude it.
      accountNumber: { type: String, trim: true, maxlength: 34, select: false },
    },
    bankAccountEncrypted: { type: String, default: undefined, select: false },
    status: { type: String, enum: ["requested", "paid", "rejected"], default: "requested", index: true },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    processedAt: { type: Date, default: null },
    transferReference: { type: String, default: null, trim: true, maxlength: 100 },
    adminNote: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

refundRequestSchema.set("toJSON", {
  transform: (_document, result) => {
    delete result.bankAccountEncrypted;
    if (result.bank) delete result.bank.accountNumber;
    return result;
  },
});

refundRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.RefundRequest || mongoose.model("RefundRequest", refundRequestSchema);
