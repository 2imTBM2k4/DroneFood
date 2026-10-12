const mongoose = require("mongoose");
const addressBookEntrySchema = require("./addressBookEntrySchema.cjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: [
        "user",
        "restaurant_owner",
        "merchant_owner",
        "branch_manager",
        "shipper",
        "admin",
      ],
      default: "user",
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    address: {
      fullName: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      zipCode: { type: String, default: "" },
      phone: { type: String, default: "" },
      // Exact coordinates from the map picker / geolocation, when provided.
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    // `address` remains as a temporary read-compatibility field for clients
    // that have not moved to the address-book APIs yet.
    addressBook: { type: [addressBookEntrySchema], default: [] },
    cart: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Food",
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
        size: String,
        color: String,
      },
    ],
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Food",
      },
    ],
    locked: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: true },
    emailVerificationToken: { type: String, default: null, select: false },
    emailVerificationTokenExpires: { type: Date, default: null, select: false },
    balance: { type: Number, default: 0 },
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
    refreshToken: { type: String, default: null, select: false },
    pendingEmail: { type: String, select: false },
    emailVerificationOtp: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    pendingPhone: { type: String, select: false },
    phoneVerificationOtp: { type: String, select: false },
    phoneVerificationExpires: { type: Date, select: false },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
