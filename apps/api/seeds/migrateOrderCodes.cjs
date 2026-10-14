const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const Order = require("../models/orderModel.cjs");

async function migrate() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/drone-food";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB for orderCode migration...");

  const ordersWithoutCode = await Order.find({
    $or: [
      { orderCode: { $exists: false } },
      { orderCode: null },
      { orderCode: "" },
    ],
  });

  console.log(`Found ${ordersWithoutCode.length} orders without orderCode.`);
  let updatedCount = 0;

  for (const order of ordersWithoutCode) {
    const code = Order.generateOrderCode(order.createdAt || new Date());
    order.orderCode = code;
    await order.save();
    updatedCount++;
  }

  console.log(`Successfully migrated ${updatedCount} orders with new orderCode format.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}

module.exports = migrate;
