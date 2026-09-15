const mongoose = require("mongoose");

// One immutable decision for each reviewable party on an order. A skipped
// target is intentionally stored too, so the customer is never prompted again.
const orderReviewSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["shipper", "food"], required: true },
    target: { type: mongoose.Schema.Types.ObjectId, required: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", default: null },
    outcome: { type: String, enum: ["rated", "skipped"], required: true },
    rating: { type: Number, min: 1, max: 5, default: null },
    comment: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

orderReviewSchema.index({ order: 1, targetType: 1, target: 1 }, { unique: true });
orderReviewSchema.index({ targetType: 1, target: 1, outcome: 1 });

module.exports = mongoose.models.OrderReview || mongoose.model("OrderReview", orderReviewSchema);
