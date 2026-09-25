import dotenv from "dotenv";
import mongoose from "mongoose";
import { expireUnacceptedOrders } from "../services/shipperService.js";

dotenv.config();

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required for the shipper-expiry job");
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const { cancelledCount } = await expireUnacceptedOrders();
  console.log(JSON.stringify({ job: "expire-unaccepted-shipper-orders", cancelledCount }));
} finally {
  await mongoose.disconnect();
}
