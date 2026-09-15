import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import foodRouter from "./routes/foodRoute.js";
import userRouter from "./routes/userRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import restaurantRouter from "./routes/restaurantRoute.js";
import droneRouter from "./routes/droneRoute.js";
import configRouter from "./routes/configRoute.js";
import auditRouter from "./routes/auditRoute.js";
import shipperRouter from "./routes/shipperRoute.js";
import walletRouter from "./routes/walletRoute.js";
import restaurantWithdrawalRouter from "./routes/restaurantWithdrawalRoute.js";
import withdrawalRouter from "./routes/withdrawalRoute.js";
import shipperAccountClosureRouter from "./routes/shipperAccountClosureRoute.js";
import voucherRouter from "./routes/voucherRoute.js";
import refundRouter from "./routes/refundRoute.js";
import addressBookRouter from "./routes/addressBookRoute.js";
import orderReviewRouter from "./routes/orderReviewRoute.js";

const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

app.use("/images", express.static("uploads"));

const cleanOrderPayload = (req, res, next) => {
  if (req.path === "/place" && req.body.restaurantId) {
    const { restaurantId } = req.body;
    if (
      typeof restaurantId === "object" &&
      restaurantId !== null &&
      restaurantId._id
    ) {
      req.body.restaurantId = restaurantId._id;
    }
  }
  next();
};

app.use("/api/food", foodRouter);
app.use("/api/user", userRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", cleanOrderPayload, orderRouter);
app.use("/api/restaurant", restaurantRouter);
app.use("/api/drone", droneRouter);
app.use("/api/config", configRouter);
app.use("/api/audit", auditRouter);
app.use("/api/shippers", shipperRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/restaurant-withdrawals", restaurantWithdrawalRouter);
app.use("/api/withdrawals", withdrawalRouter);
app.use("/api/shipper/account-closure", shipperAccountClosureRouter);
app.use("/api/vouchers", voucherRouter);
app.use("/api/refunds", refundRouter);
app.use("/api/address-book", addressBookRouter);
app.use("/api/order-reviews", orderReviewRouter);

app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  const isHealthy = dbState === 1;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    database: dbStatus[dbState] || "unknown",
    uptime: process.uptime(),
  });
});

app.use((err, req, res, next) => {
  if (err.isJoi) {
    const messages = err.details.map((d) => d.message).join(", ");
    return res.status(400).json({ success: false, message: messages });
  }

  if (err.name === "CastError") {
    return res
      .status(400)
      .json({ success: false, message: `ID không hợp lệ: ${err.value}` });
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
    return res.status(400).json({ success: false, message: messages });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue).join(", ");
    return res
      .status(409)
      .json({ success: false, message: `${field} đã tồn tại` });
  }

  if (err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ success: false, message: "JSON không hợp lệ" });
  }

  const statusCode = err.statusCode || err.status || 500;
  if (statusCode === 500) {
    console.error("Server error:", err.stack || err);
  }
  res
    .status(statusCode)
    .json({ success: false, message: err.message || "Server error" });
});

app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: `Cannot ${req.method} ${req.path}` });
});

export default app;
