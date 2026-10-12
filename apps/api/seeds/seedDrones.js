import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Drone from "../models/droneModel.cjs";
import Hub from "../models/Hub.cjs";

dotenv.config();

const objectIdPattern = /^[a-f\d]{24}$/i;

export const resolveHubId = async ({ argv = process.argv.slice(2), env = process.env } = {}) => {
  const inlineArg = argv.find((arg) => arg.startsWith("--hub-id="));
  const hubFlagIndex = argv.indexOf("--hub-id");
  const cliValue = inlineArg?.slice("--hub-id=".length)
    || (hubFlagIndex >= 0 ? argv[hubFlagIndex + 1] : undefined);
  const value = String(cliValue || env.SEED_DRONE_HUB_ID || "").trim();

  if (value) {
    if (!objectIdPattern.test(value) || !mongoose.Types.ObjectId.isValid(value)) {
      throw new Error("A valid hub ID is required. Pass --hub-id <ObjectId> or set SEED_DRONE_HUB_ID.");
    }
    return new mongoose.Types.ObjectId(value);
  }

  // Fallback: tìm Hub active có sẵn hoặc tạo hub mặc định nếu chưa có
  const existingHub = await Hub.findOne({ status: "active" });
  if (existingHub) {
    return existingHub._id;
  }

  const defaultHub = await Hub.create({
    name: "Hub mặc định",
    code: "HUB-DEFAULT",
    address: {
      text: "Trung tâm điều hành Drone TP.HCM",
      lat: Number(env.HUB_DEFAULT_LAT) || 10.7769,
      lng: Number(env.HUB_DEFAULT_LNG) || 106.7009,
    },
    location: {
      type: "Point",
      coordinates: [
        Number(env.HUB_DEFAULT_LNG) || 106.7009,
        Number(env.HUB_DEFAULT_LAT) || 10.7769,
      ],
    },
    status: "active",
  });
  return defaultHub._id;
};

export const seedDrones = async ({ hubId = null } = {}) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const resolvedHubId = hubId || (await resolveHubId());
    const hubExists = await Hub.exists({ _id: resolvedHubId });
    if (!hubExists) {
      throw new Error(`Hub ${resolvedHubId} does not exist; no drones were changed.`);
    }

    // Xóa drones cũ
    await Drone.deleteMany({});
    console.log("Cleared existing drones");

    // Tạo drones mẫu
    const drones = [
      {
        hubId: resolvedHubId,
        droneCode: "DRONE-001",
        cargoWeight: 0,
        status: "available",
        cargoLidStatus: "closed",
        batteryLevel: 100,
        totalDeliveries: 0,
      },
      {
        hubId: resolvedHubId,
        droneCode: "DRONE-002",
        cargoWeight: 0,
        status: "available",
        cargoLidStatus: "closed",
        batteryLevel: 95,
        totalDeliveries: 0,
      },
      {
        hubId: resolvedHubId,
        droneCode: "DRONE-003",
        cargoWeight: 0,
        status: "available",
        cargoLidStatus: "closed",
        batteryLevel: 88,
        totalDeliveries: 0,
      },
      {
        hubId: resolvedHubId,
        droneCode: "DRONE-004",
        cargoWeight: 0,
        status: "available",
        cargoLidStatus: "closed",
        batteryLevel: 92,
        totalDeliveries: 0,
      },
      {
        hubId: resolvedHubId,
        droneCode: "DRONE-005",
        cargoWeight: 0,
        status: "available",
        cargoLidStatus: "closed",
        batteryLevel: 100,
        totalDeliveries: 0,
      },
      {
        hubId: resolvedHubId,
        droneCode: "DRONE-006",
        cargoWeight: 0,
        status: "available",
        cargoLidStatus: "closed",
        batteryLevel: 90,
        totalDeliveries: 0,
      },
    ];

    await Drone.insertMany(drones);
    console.log(`✅ Successfully seeded ${drones.length} drones to hub ${resolvedHubId}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error seeding drones:", error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    throw error;
  }
};

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  seedDrones().catch(() => {
    process.exitCode = 1;
  });
}
