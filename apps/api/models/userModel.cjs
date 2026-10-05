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
      enum: ["user", "restaurant_owner", "shipper", "admin"],
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
    balance: { type: Number, default: 0 },
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
    lastResetPasswordToken: { type: String, default: null, select: false },
    // Missing means "verified" for accounts created before mandatory email
    // verification was introduced. New registrations explicitly persist false.
    emailVerified: { type: Boolean, default: undefined },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationToken: { type: String, default: null, select: false },
    emailVerificationExpires: { type: Date, default: null, select: false },
    lastEmailVerificationToken: { type: String, default: null, select: false },
    pendingEmail: { type: String, lowercase: true, trim: true, select: false },
    pendingEmailVerificationToken: { type: String, default: null, select: false },
    pendingEmailVerificationExpires: { type: Date, default: null, select: false },
    lastPendingEmailVerificationToken: { type: String, default: null, select: false },
    refreshToken: { type: String, default: null, select: false },
    // Every access/refresh JWT carries the value current at issue time. A
    // password change increments it so already-issued tokens are rejected by
    // both HTTP and Socket.IO authentication immediately.
    authVersion: { type: Number, default: 0, min: 0, select: false },
  },
  {
    timestamps: true,
  }
);

// Two users must never reserve the same pending identity email. The primary
// email keeps its existing unique index; service-level checks also prevent a
// pending address from colliding with an existing primary address.
userSchema.index({ pendingEmail: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
