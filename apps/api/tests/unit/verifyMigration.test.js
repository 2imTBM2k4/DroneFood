import fs from "fs";
import os from "os";
import path from "path";
import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { verifyMigration } from "../../scripts/verify-migration.cjs";

describe("verify-migration script unit tests", () => {
  let tmpDir;
  let mappingFilePath;
  let db;

  beforeEach(async () => {
    db = mongoose.connection.db;
    await db.dropDatabase();

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-migration-test-"));
    mappingFilePath = path.join(tmpDir, "multi-branch-mapping-test.json");
  });

  const setupValidDatabase = async () => {
    const restaurantId = new mongoose.Types.ObjectId();
    const branchId = new mongoose.Types.ObjectId();
    const ownerUserId = new mongoose.Types.ObjectId();

    // 1. Merchant & Branch
    await db.collection("merchants").insertOne({
      _id: restaurantId,
      name: "Phở Việt Test",
      slug: "pho-viet-test",
      ownerUserId,
      status: "active",
      type: "individual",
      branchCount: 1,
      legacyRestaurantId: restaurantId,
    });

    await db.collection("branches").insertOne({
      _id: branchId,
      merchantId: restaurantId,
      name: "Chi nhánh chính",
      code: "MAIN",
      status: "active",
      isOpen: true,
      location: { type: "Point", coordinates: [106.701, 10.775] },
    });

    // 2. Indexes
    await db.collection("merchants").createIndex({ slug: 1 }, { unique: true });
    await db.collection("merchants").createIndex({ ownerUserId: 1 }, { unique: true });
    await db.collection("branches").createIndex({ merchantId: 1, code: 1 }, { unique: true });
    await db.collection("branches").createIndex({ location: "2dsphere" });
    await db.collection("carts").createIndex(
      { userId: 1, branchId: 1 },
      { unique: true, partialFilterExpression: { branchId: { $type: "objectId" } } }
    );
    await db.collection("carts").createIndex(
      { userId: 1, restaurantId: 1 },
      { unique: true, partialFilterExpression: { restaurantId: { $type: "objectId" } } }
    );

    const hubId = new mongoose.Types.ObjectId();
    await db.collection("hubs").insertOne({
      _id: hubId,
      name: "Hub Mặc Định",
      code: "HUB-DEFAULT",
      location: { type: "Point", coordinates: [106.7009, 10.7769] },
      status: "active",
    });
    await db.collection("hubs").createIndex({ code: 1 }, { unique: true });
    await db.collection("hubs").createIndex({ location: "2dsphere" });
    await db.collection("hubs").createIndex({ status: 1 });

    // 3. Dependent documents
    await db.collection("foods").insertOne({
      name: "Phở bò",
      merchantId: restaurantId,
    });
    await db.collection("orders").insertOne({
      merchantId: restaurantId,
      branchId,
    });
    await db.collection("drones").insertOne({
      hubId,
      droneCode: "DRONE-01",
      status: "available",
    });
    await db.collection("drones").createIndex({ hubId: 1, status: 1 });

    // 4. Mapping file
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

  it("passes all checks when database and mapping are fully consistent and indexes exist", async () => {
    await setupValidDatabase();

    const result = await verifyMigration({
      db,
      artifactDir: tmpDir,
      mappingFile: mappingFilePath,
    });

    expect(result.success).toBe(true);
    const failures = result.results.filter((r) => r.status === "FAIL");
    expect(failures).toHaveLength(0);
  });

  it("fails when branchCount does not match actual active branches count, and fixes with --fix-branch-count", async () => {
    const { restaurantId } = await setupValidDatabase();

    // Deliberately corrupt branchCount
    await db.collection("merchants").updateOne({ _id: restaurantId }, { $set: { branchCount: 99 } });

    // Run without fix -> fails
    const failResult = await verifyMigration({
      db,
      artifactDir: tmpDir,
      mappingFile: mappingFilePath,
      fixBranchCount: false,
    });

    expect(failResult.success).toBe(false);
    const branchCountCheck = failResult.results.find((r) => r.code === "BRANCH_COUNT");
    expect(branchCountCheck.status).toBe("FAIL");

    // Run with --fix-branch-count -> warns and repairs
    const fixResult = await verifyMigration({
      db,
      artifactDir: tmpDir,
      mappingFile: mappingFilePath,
      fixBranchCount: true,
    });

    expect(fixResult.success).toBe(true);
    const fixedMerchant = await db.collection("merchants").findOne({ _id: restaurantId });
    expect(fixedMerchant.branchCount).toBe(1);
  });

  it("fails when required unique or 2dsphere indexes are missing", async () => {
    await setupValidDatabase();

    // Drop unique index
    await db.collection("merchants").dropIndex("slug_1");

    const result = await verifyMigration({
      db,
      artifactDir: tmpDir,
      mappingFile: mappingFilePath,
    });

    expect(result.success).toBe(false);
    const indexCheck = result.results.find((r) => r.code === "INDEX_MERCHANT");
    expect(indexCheck.status).toBe("FAIL");
    expect(indexCheck.message).toContain("Thiếu index Merchant");
  });
});
