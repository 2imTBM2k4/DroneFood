const mongoose = require("mongoose");

// A 2dsphere index rejects a GeoJSON Point without coordinates. Keep the
// entire value absent until the shipper has granted GPS permission and sent a
// real position.
const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite),
        message: "A location point requires longitude and latitude.",
      },
    },
  },
  { _id: false }
);

const shipperProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    status: {
      type: String,
      enum: ["offline", "available", "assigned", "delivering"],
      default: "offline",
      index: true,
    },
    vehicleType: { type: String, enum: ["motorbike", "bicycle", "car"], default: "motorbike" },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    currentLocation: { type: geoPointSchema, default: undefined },
    locationUpdatedAt: { type: Date, default: null },
    pushToken: { type: String, default: "" },
    currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { timestamps: true }
);

shipperProfileSchema.index({ currentLocation: "2dsphere" });
shipperProfileSchema.index({ status: 1, locationUpdatedAt: -1 });

module.exports = mongoose.models.ShipperProfile || mongoose.model("ShipperProfile", shipperProfileSchema);
