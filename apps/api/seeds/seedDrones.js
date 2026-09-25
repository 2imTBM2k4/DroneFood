import mongoose from "mongoose";
import dotenv from "dotenv";
import Drone from "../models/droneModel.cjs";

dotenv.config();

const seedDrones = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Xóa drones cũ
    await Drone.deleteMany({});
    console.log("Cleared existing drones");

    // Tạo drones mẫu
    const drones = [
      {
        droneCode: "DRONE-001",
        cargoWeight: 0,
        status: "available",
        cargoLidStatus: "closed",
        batteryLevel: 100,
        totalDeliveries: 0,
      },
      {
        droneCode: "DRONE-002",
        cargoWeight: 0,
        status: "available",
        cargoLidStatus: "closed",
        batteryLevel: 95,
        totalDeliveries: 0,
      },
      {
        droneCode: "DRONE-003",
        cargoWeight: 0,
        status: "available",
        cargoLidStatus: "closed",
        batteryLevel: 88,
        totalDeliveries: 0,
      },
      {
        droneCode: "DRONE-004",
        cargoWeight: 0,
        status: "available",
        cargoLidStatus: "closed",
        batteryLevel: 92,
        totalDeliveries: 0,
      },
      {
        droneCode: "DRONE-005",
        cargoWeight: 0,
        status: "available",
        cargoLidStatus: "closed",
        batteryLevel: 100,
        totalDeliveries: 0,
      },
    ];

    await Drone.insertMany(drones);
    console.log("✅ Successfully seeded 5 drones");

    mongoose.connection.close();
  } catch (error) {
    console.error("Error seeding drones:", error);
    process.exit(1);
  }
};

seedDrones();
