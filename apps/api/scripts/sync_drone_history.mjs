import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Order from "../models/orderModel.cjs";
import DroneDeliveryHistory from "../models/droneDeliveryHistoryModel.cjs";
import Restaurant from "../models/restaurantModel.cjs";
import User from "../models/userModel.cjs";
import Drone from "../models/droneModel.cjs";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const orders = await Order.find({ droneId: { $ne: null } })
    .populate("restaurantId")
    .populate("user")
    .populate("droneId");

  console.log(`Found ${orders.length} orders with droneId`);
  let synced = 0;

  for (const order of orders) {
    if (!order.droneId) continue;

    const droneObjectId = order.droneId._id || order.droneId;
    const existing = await DroneDeliveryHistory.findOne({
      orderId: order._id,
      droneId: droneObjectId,
    });

    if (!existing) {
      const restAddress = order.restaurantId?.address?.fullAddress || order.restaurantId?.address || "Hồ Chí Minh";
      const custAddress = typeof order.shippingAddress === "object"
        ? `${order.shippingAddress.address || ""}, ${order.shippingAddress.city || ""}`.trim()
        : String(order.shippingAddress || "N/A");

      const custName = typeof order.shippingAddress === "object" && order.shippingAddress.fullName
        ? order.shippingAddress.fullName
        : order.user?.name || "Khách hàng";

      const custPhone = typeof order.shippingAddress === "object" && order.shippingAddress.phone
        ? order.shippingAddress.phone
        : order.user?.phone || "";

      let historyStatus = "delivering";
      if (order.orderStatus === "delivered") historyStatus = "delivered";
      else if (order.orderStatus === "cancelled") historyStatus = "cancelled";

      await DroneDeliveryHistory.create({
        droneId: droneObjectId,
        orderId: order._id,
        restaurantId: order.restaurantId?._id || order.restaurantId,
        customerId: order.user?._id || order.user,
        restaurantAddress: restAddress,
        customerAddress: custAddress || "Hồ Chí Minh",
        customerName: custName,
        customerPhone: custPhone,
        startTime: order.createdAt || new Date(),
        endTime: order.deliveredAt || (order.orderStatus === "delivered" ? order.updatedAt : undefined),
        status: historyStatus,
        qrCode: order.qrCode || "N/A",
        cargoWeight: 1000,
        totalPrice: order.totalPrice || 0,
      });
      synced++;
    }
  }

  console.log(`Synced ${synced} historical orders into DroneDeliveryHistory.`);
  const totalInDb = await DroneDeliveryHistory.countDocuments();
  console.log(`Total records in DroneDeliveryHistory: ${totalInDb}`);

  await mongoose.disconnect();
  console.log("Done");
}

main().catch(console.error);
