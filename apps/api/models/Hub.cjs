const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    text: { type: String, default: "" },
    lat: { type: Number, default: null, min: -90, max: 90 },
    lng: { type: Number, default: null, min: -180, max: 180 },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number],
      validate: {
        validator: (coordinates) =>
          coordinates == null ||
          (coordinates.length === 2 &&
            Number.isFinite(coordinates[0]) &&
            Number.isFinite(coordinates[1]) &&
            Math.abs(coordinates[0]) <= 180 &&
            Math.abs(coordinates[1]) <= 90),
        message: "Hub location must be [longitude, latitude].",
      },
    },
  },
  { _id: false }
);

const hubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: { type: addressSchema, default: () => ({}) },
    location: { type: locationSchema, default: undefined },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },
    capacity: { type: Number, default: null, min: 0 },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

hubSchema.index({ code: 1 }, { unique: true });
hubSchema.index({ location: "2dsphere" });
hubSchema.index({ status: 1 });

module.exports = mongoose.models.Hub || mongoose.model("Hub", hubSchema);
