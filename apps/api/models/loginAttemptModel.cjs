const mongoose = require("mongoose");

const loginAttemptSchema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      enum: ["email", "ip"],
      required: true,
    },
    subjectKey: {
      type: String,
      required: true,
    },
    failureCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

loginAttemptSchema.index({ subjectType: 1, subjectKey: 1 }, { unique: true });
loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.LoginAttempt || mongoose.model("LoginAttempt", loginAttemptSchema);
