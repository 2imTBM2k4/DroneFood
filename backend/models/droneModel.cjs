const mongoose = require("mongoose");

const droneSchema = new mongoose.Schema(
  {
    droneCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    cargoWeight: {
      type: Number,
      default: 0,
      min: 0,
      comment: "Trọng lượng khoang hàng (gram) - để kiểm tra khách đã lấy đồ ăn",
    },
    status: {
      type: String,
      enum: ["available", "delivering", "delivered", "maintenance", "offline"],
      default: "available",
      comment: "Trạng thái drone: sẵn sàng, đang giao, đã giao, bảo trì, ngoại tuyến",
    },
    cargoLidStatus: {
      type: String,
      enum: ["open", "closed"],
      default: "closed",
      comment: "Trạng thái nắp khoang hàng: đang mở, đang đóng",
    },
    currentOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      comment: "Đơn hàng hiện tại đang giao",
    },
    batteryLevel: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
      comment: "Mức pin (%)",
    },
    lastMaintenance: {
      type: Date,
      default: Date.now,
    },
    totalDeliveries: {
      type: Number,
      default: 0,
      comment: "Tổng số lần giao hàng",
    },
  },
  {
    timestamps: true,
  }
);

// Middleware ngăn xóa drone đã giao hàng
droneSchema.pre(["deleteOne", "findOneAndDelete"], async function (next) {
  const Drone = require("./droneModel.cjs");
  const filter = this.getFilter();
  const droneId = filter._id;

  if (!droneId) return next();

  const drone = await Drone.findById(droneId);
  if (!drone) return next();

  if (drone.status === "delivering") {
    const error = new Error("Không thể xóa drone đang giao hàng.");
    error.name = "DroneDeleteError";
    return next(error);
  }

  if (drone.totalDeliveries > 0) {
    const error = new Error(
      `Không thể xóa drone đã hoàn thành ${drone.totalDeliveries} đơn hàng.`
    );
    error.name = "DroneDeleteError";
    return next(error);
  }

  next();
});

module.exports = mongoose.models.Drone || mongoose.model("Drone", droneSchema);
