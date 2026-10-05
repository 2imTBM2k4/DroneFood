import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";
import { Server } from "socket.io";
import http from "http";
import { v2 as cloudinary } from "cloudinary";
import { startShipperExpiryScheduler } from "./services/shipperService.js";
import { startAccountEmailWorker, stopAccountEmailWorker } from "./services/accountEmailOutboxService.js";
import { authenticateSocket } from "./middleware/socketAuth.js";
import { joinUserSessionRoom } from "./utils/socketSessions.js";
import { logger } from "./utils/logger.js";
import { shutdownDeadlineMs } from "./utils/shutdownTiming.js";
import { initializeIndexes as initializeAccountEmailJobIndexes } from "./repositories/accountEmailJobRepository.js";
import { initializeIndexes as initializeUserIndexes } from "./repositories/userRepository.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const server = http.createServer(app);
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

app.use((req, res, next) => {
  req.io = io;
  next();
});

io.use(authenticateSocket);

io.on("connection", (socket) => {
  joinUserSessionRoom(socket);
  socket.on("joinRestaurant", (restaurantId) => {
    if (socket.user.role === "restaurant_owner" && String(socket.user.restaurantId) === String(restaurantId)) {
      socket.join(`restaurant_${restaurantId}`);
    }
  });
  socket.on("joinShipper", () => {
    if (socket.user.role === "shipper") socket.join(`shipper_${socket.user._id}`);
  });
  socket.on("joinCustomer", () => socket.join(`customer_${socket.user._id}`));
  socket.on("joinNotifications", () => {
    const room = socket.user.role === "restaurant_owner"
      ? `restaurant_owner_${socket.user._id}`
      : `${socket.user.role}_${socket.user._id}`;
    socket.join(room);
  });
});

const PORT = process.env.PORT || 4000;

await connectDB();
await Promise.all([initializeAccountEmailJobIndexes(), initializeUserIndexes()]);
const shipperExpiryTimer = startShipperExpiryScheduler();
startAccountEmailWorker();

server.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || "development" }, `Server running on port ${PORT}`);
});

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Stopping server");
  const forceExit = setTimeout(() => process.exit(1), shutdownDeadlineMs());
  forceExit.unref?.();
  clearInterval(shipperExpiryTimer);
  const socketsClosed = new Promise((resolve) => io.close(resolve));
  await Promise.all([stopAccountEmailWorker(), socketsClosed]);
  if (server.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
  clearTimeout(forceExit);
  process.exit(0);
};

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
