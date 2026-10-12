const mongoose = require("mongoose");

const merchantSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["individual", "brand"],
      default: "individual",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    logoUrl: { type: String, default: "" },
    coverUrl: { type: String, default: "" },
    description: { type: String, default: "" },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: { type: Date, default: null },
    rejectReason: { type: String, default: "" },
    revenueShare: {
      merchant: { type: Number, default: 0.8 },
      platform: { type: Number, default: 0.2 },
    },
    branchCount: { type: Number, default: 0, min: 0 },
    // Deprecated compatibility field for backfill from legacy restaurant collection
    legacyRestaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },
  },
  { timestamps: true }
);

merchantSchema.index({ slug: 1 }, { unique: true });
merchantSchema.index({ ownerUserId: 1 }, { unique: true });
merchantSchema.index({ status: 1, type: 1 });
merchantSchema.index({ legacyRestaurantId: 1 });

module.exports =
  mongoose.models.Merchant || mongoose.model("Merchant", merchantSchema);
