import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";
import { Server } from "socket.io";
import http from "http";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import User from "./models/userModel.cjs";
import { startShipperExpiryScheduler } from "./services/shipperService.js";

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

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
    if (!token) return next(new Error("Authentication required"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === "refresh") return next(new Error("Access token required"));
    const user = await User.findById(decoded.id).select("role restaurantId locked").lean();
    if (!user || user.locked) return next(new Error("Unauthorized"));
    socket.user = user;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
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
startShipperExpiryScheduler();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
