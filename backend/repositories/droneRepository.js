import Drone from "../models/droneModel.cjs";

export const findAll = async () => {
  return await Drone.find().populate("currentOrder").sort({ createdAt: -1 });
};

export const findById = async (id) => {
  return await Drone.findById(id).populate("currentOrder");
};

export const findByCode = async (droneCode) => {
  return await Drone.findOne({ droneCode });
};

export const findAvailable = async () => {
  return await Drone.find({ status: "available" }).sort({ totalDeliveries: 1 });
};

/**
 * A drone must hold enough charge for the whole round trip. Dispatching one
 * that is nearly flat risks it coming down mid-flight, so anything below this
 * stays on the ground until it is charged.
 */
export const MIN_BATTERY_PERCENT = 30;

export const claimAvailable = async (orderId, cargoWeight) => {
  // Among the drones fit to fly, the least-used one goes first so wear spreads
  // evenly across the fleet.
  return await Drone.findOneAndUpdate(
    { status: "available", batteryLevel: { $gte: MIN_BATTERY_PERCENT } },
    {
      $set: {
        status: "delivering",
        currentOrder: orderId,
        cargoWeight,
      },
    },
    { new: true, sort: { totalDeliveries: 1 } }
  );
};

export const create = async (droneData) => {
  const drone = new Drone(droneData);
  return await drone.save();
};

export const update = async (id, updateData) => {
  return await Drone.findByIdAndUpdate(id, updateData, { new: true });
};

export const deleteById = async (id) => {
  return await Drone.findByIdAndDelete(id);
};

export const getFleetStats = async () => {
  const drones = await Drone.find();
  const total = drones.length;
  let available = 0;
  let delivering = 0;
  let maintenance = 0;
  let offline = 0;
  let lowBattery = 0;
  let availableWithBattery = 0;
  let totalBattery = 0;

  for (const drone of drones) {
    totalBattery += drone.batteryLevel || 0;
    if (drone.batteryLevel < MIN_BATTERY_PERCENT) {
      lowBattery++;
    }
    if (drone.status === "available") {
      available++;
      if (drone.batteryLevel >= MIN_BATTERY_PERCENT) {
        availableWithBattery++;
      }
    } else if (drone.status === "delivering") {
      delivering++;
    } else if (drone.status === "maintenance") {
      maintenance++;
    } else if (drone.status === "offline") {
      offline++;
    }
  }

  return {
    total,
    available,
    delivering,
    maintenance,
    offline,
    lowBattery,
    availableWithBattery,
    avgBattery: total > 0 ? Math.round(totalBattery / total) : 0,
    minBatteryThreshold: MIN_BATTERY_PERCENT,
  };
};

export const resetDrone = async (id) => {
  return await Drone.findByIdAndUpdate(
    id,
    {
      $set: {
        status: "available",
        currentOrder: null,
        cargoWeight: 0,
        cargoLidStatus: "closed",
      },
    },
    { new: true }
  );
};

export const chargeDrone = async (id, batteryLevel = 100) => {
  return await Drone.findByIdAndUpdate(
    id,
    {
      $set: {
        batteryLevel: Math.min(100, Math.max(0, batteryLevel)),
      },
    },
    { new: true }
  );
};

export const resetAllStuckDrones = async () => {
  return await Drone.updateMany(
    { status: { $in: ["delivering", "delivered"] } },
    {
      $set: {
        status: "available",
        currentOrder: null,
        cargoWeight: 0,
        cargoLidStatus: "closed",
      },
    }
  );
};
