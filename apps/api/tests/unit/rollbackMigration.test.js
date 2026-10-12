import fs from "fs";
import os from "os";
import path from "path";
import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { rollbackMigration } from "../../scripts/rollback-migration.cjs";

describe("rollback-migration script unit tests", () => {
  let tmpDir;
  let mappingFilePath;
  let db;

  beforeEach(async () => {
    db = mongoose.connection.db;
    await db.dropDatabase();

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rollback-migration-test-"));
    mappingFilePath = path.join(tmpDir, "multi-branch-mapping-test.json");
  });

  const setupMigratedData = async () => {
    const restaurantId = new mongoose.Types.ObjectId();
    const branchId = new mongoose.Types.ObjectId();
    const ownerUserId = new mongoose.Types.ObjectId();

    // 1. Created merchants & branches
    await db.collection("merchants").insertOne({
      _id: restaurantId,
      name: "Quán Ăn Đã Migrate",
      ownerUserId,
      type: "individual",
      status: "active",
      branchCount: 1,
    });

    await db.collection("branches").insertOne({
      _id: branchId,
      merchantId: restaurantId,
      name: "Chi nhánh chính",
      code: "MAIN",
      status: "active",
    });

    // 2. Updated collections with new references
    await db.collection("foods").insertOne({
      _id: new mongoose.Types.ObjectId(),
      name: "Món ăn",
      restaurantId,
      merchantId: restaurantId,
    });

    await db.collection("orders").insertOne({
      _id: new mongoose.Types.ObjectId(),
      restaurantId,
      merchantId: restaurantId,
      branchId,
    });

    const defaultHubId = new mongoose.Types.ObjectId();
    await db.collection("hubs").insertOne({
      _id: defaultHubId,
      code: "HUB-DEFAULT",
      name: "Hub Mặc định",
      status: "active",
    });

    await db.collection("drones").insertOne({
      _id: new mongoose.Types.ObjectId(),
      droneCode: "D-01",
      hubId: defaultHubId,
    });

    await db.collection("carts").insertOne({
      _id: new mongoose.Types.ObjectId(),
      restaurantId,
      merchantId: restaurantId,
      branchId,
    });

    await db.collection("users").insertOne({
      _id: ownerUserId,
      role: "merchant_owner",
    });

    // 3. Mapping JSON
    const mappingContent = {
      migrationId: "multi-branch-restaurant-v1",
      mappings: [
        {
          oldRestaurantId: restaurantId.toString(),
          merchantId: restaurantId.toString(),
          branchId: branchId.toString(),
        },
      ],
    };
    fs.writeFileSync(mappingFilePath, JSON.stringify(mappingContent, null, 2));

    return { restaurantId, branchId, ownerUserId };
  };

  it("dry-run calculates rollback plan without deleting or updating any records", async () => {
    const { restaurantId, branchId, ownerUserId } = await setupMigratedData();

    const dryRunResult = await rollbackMigration({
      db,
      artifactDir: tmpDir,
      mappingFile: mappingFilePath,
      confirm: false,
    });

    expect(dryRunResult.success).toBe(true);
    expect(dryRunResult.mode).toBe("dry-run");
    expect(dryRunResult.plan).toMatchObject({
      merchantsToDelete: 1,
      branchesToDelete: 1,
      foodsToReset: 1,
      ordersToReset: 1,
      dronesToReset: 1,
      cartsToReset: 1,
      usersToRestoreRole: 1,
    });

    // Verify DB was untouched
    expect(await db.collection("merchants").countDocuments()).toBe(1);
    expect(await db.collection("branches").countDocuments()).toBe(1);
    const user = await db.collection("users").findOne({ _id: ownerUserId });
    expect(user.role).toBe("merchant_owner");
  });

  it("apply rollback deletes merchants/branches, resets fields and restores user role", async () => {
    const { restaurantId, branchId, ownerUserId } = await setupMigratedData();

    const applyResult = await rollbackMigration({
      db,
      artifactDir: tmpDir,
      mappingFile: mappingFilePath,
      confirm: true,
      logDir: tmpDir,
    });

    expect(applyResult.success).toBe(true);
    expect(applyResult.mode).toBe("apply");
    expect(applyResult.logPath).toBeDefined();

    // Verify Merchants and Branches deleted
    expect(await db.collection("merchants").countDocuments({ _id: restaurantId })).toBe(0);
    expect(await db.collection("branches").countDocuments({ _id: branchId })).toBe(0);

    // Verify fields reset on dependent collections
    const food = await db.collection("foods").findOne({ restaurantId });
    expect(food.merchantId).toBeUndefined();

    const order = await db.collection("orders").findOne({ restaurantId });
    expect(order.merchantId).toBeUndefined();
    expect(order.branchId).toBeUndefined();

    const drone = await db.collection("drones").findOne({});
    expect(drone.hubId).toBeUndefined();
    expect(await db.collection("hubs").countDocuments()).toBe(0);

    const cart = await db.collection("carts").findOne({ restaurantId });
    expect(cart.branchId).toBeUndefined();
    expect(cart.merchantId).toBeUndefined();

    // Verify User role restored
    const user = await db.collection("users").findOne({ _id: ownerUserId });
    expect(user.role).toBe("restaurant_owner");
  });

  it("is idempotent when run repeatedly in apply mode without throwing errors", async () => {
    await setupMigratedData();

    // First apply
    await rollbackMigration({
      db,
      artifactDir: tmpDir,
      mappingFile: mappingFilePath,
      confirm: true,
    });

    // Second apply
    const secondResult = await rollbackMigration({
      db,
      artifactDir: tmpDir,
      mappingFile: mappingFilePath,
      confirm: true,
    });

    expect(secondResult.success).toBe(true);
    expect(secondResult.executionSummary.merchantsToDelete).toBe(0);
    expect(secondResult.executionSummary.branchesToDelete).toBe(0);
  });
});
