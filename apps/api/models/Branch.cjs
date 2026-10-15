const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    text: { type: String, default: "" },
    lat: { type: Number, default: null, min: -90, max: 90 },
    lng: { type: Number, default: null, min: -180, max: 180 },
    geocodedAt: { type: Date, default: null },
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
        message: "Branch location must be [longitude, latitude].",
      },
    },
  },
  { _id: false }
);

const operatingHourSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    open: { type: String, required: true },
    close: { type: String, required: true },
  },
  { _id: false }
);

const droneDeliveryApplicationSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["not_registered", "pending", "approved", "rejected"], default: "not_registered" },
    submissionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    address: { type: addressSchema, default: () => ({}) },
    contactName: { type: String, trim: true, maxlength: 100, default: "" },
    contactPhone: { type: String, trim: true, maxlength: 15, default: "" },
    handoverNotes: { type: String, trim: true, maxlength: 1000, default: "" },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    submittedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewReason: { type: String, trim: true, maxlength: 255, default: "" },
  },
  { _id: false }
);

const branchSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: { type: addressSchema, default: () => ({}) },
    location: { type: locationSchema, default: undefined },
    phone: { type: String, default: "" },
    operatingHours: { type: [operatingHourSchema], default: [] },
    isOpen: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "active", "locked"],
      default: "pending",
      required: true,
    },
    images: { type: [String], default: [] },
    managerUserIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    deliveryRadiusKm: { type: Number, default: null, min: 0 },
    droneDeliveryEnabled: { type: Boolean, default: false },
    droneDeliveryApplication: { type: droneDeliveryApplicationSchema, default: () => ({}), select: false },
  },
  { timestamps: true }
);

branchSchema.index({ merchantId: 1, code: 1 }, { unique: true });
branchSchema.index({ location: "2dsphere" });
branchSchema.index({ merchantId: 1, isOpen: 1, status: 1 });

module.exports =
  mongoose.models.Branch || mongoose.model("Branch", branchSchema);
