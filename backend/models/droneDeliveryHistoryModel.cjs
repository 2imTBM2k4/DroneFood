const mongoose = require("mongoose");

const droneDeliveryHistorySchema = new mongoose.Schema(
  {
    droneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drone",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    restaurantAddress: { type: String, default: "Hồ Chí Minh" },
    customerAddress: { type: String, default: "Hồ Chí Minh" },
    customerName: { type: String, default: "Khách hàng" },
    customerPhone: { type: String },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    status: {
      type: String,
      enum: ["delivering", "delivered", "cancelled"],
      default: "delivering",
    },
    qrCode: { type: String },
    cargoWeight: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
  },
  { timestamps: true }
);

droneDeliveryHistorySchema.index({ droneId: 1, createdAt: -1 });
droneDeliveryHistorySchema.index({ orderId: 1 });

module.exports = mongoose.models.DroneDeliveryHistory || mongoose.model("DroneDeliveryHistory", droneDeliveryHistorySchema);
