const mongoose = require("mongoose");

// A device token is owned by exactly one signed-in account at a time. Keeping
// it separate from User supports multiple devices without ever returning the
// token through profile or notification APIs.
const expoPushTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, trim: true, unique: true, maxlength: 255 },
    platform: { type: String, enum: ["android", "ios"], required: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false }
);

expoPushTokenSchema.index({ user: 1, token: 1 }, { unique: true });

module.exports = mongoose.models.ExpoPushToken || mongoose.model("ExpoPushToken", expoPushTokenSchema);
