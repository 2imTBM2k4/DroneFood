const mongoose = require("mongoose");

const restaurantWithdrawalSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    amount: { type: Number, required: true, min: 500000 },
    status: { type: String, enum: ["pending", "approved"], default: "pending", index: true },
    approvedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

restaurantWithdrawalSchema.index({ restaurant: 1, createdAt: -1 });

module.exports = mongoose.models.RestaurantWithdrawal || mongoose.model("RestaurantWithdrawal", restaurantWithdrawalSchema);
