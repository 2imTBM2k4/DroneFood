import fs from "fs";
import os from "os";
import path from "path";
import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import migration from "../../seeds/migrate-to-multi-branch.cjs";

describe("multi-branch migration", () => {
  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  it("is a no-op on an empty database in dry-run and repeated apply modes", async () => {
    const dryRun = await migration.runMigration({
      db: mongoose.connection.db,
      dryRun: true,
      writeFiles: false,
    });
    const firstApply = await migration.runMigration({
      db: mongoose.connection.db,
      dryRun: false,
      phase2Ready: true,
      writeFiles: false,
    });
    const secondApply = await migration.runMigration({
      db: mongoose.connection.db,
      dryRun: false,
      phase2Ready: true,
      writeFiles: false,
    });

    for (const result of [dryRun, firstApply, secondApply]) {
      expect(result.summary).toMatchObject({
        restaurants: 0,
        merchantsCreated: 0,
        branchesCreated: 0,
        foodsUpdated: 0,
        ordersUpdated: 0,
        dronesUpdated: 0,
        cartsUpdated: 0,
        auditLogsUpdated: 0,
        usersUpdated: 0,
      });
      expect(result.mappings).toEqual([]);
      expect(result.changes).toEqual([]);
    }

    const collectionNames = (await mongoose.connection.db.listCollections().toArray())
      .map((collection) => collection.name);
    expect(collectionNames).not.toContain("merchants");
    expect(collectionNames).not.toContain("branches");
  });

  it("backfills one legacy restaurant once and stays idempotent", async () => {
    const db = mongoose.connection.db;
    const restaurantId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const referencedCollections = ["foods", "orders", "drones", "carts"];

    await db.collection("restaurants").insertOne({
      _id: restaurantId,
      name: "Bếp Việt",
      owner: ownerId,
      address: "1 Nguyễn Huệ",
      lat: 10.775,
      lng: 106.703,
      image: "https://example.com/restaurant.jpg",
      phone: "0900000000",
      isLocked: false,
      isOpen: true,
      openingHours: { openTime: "06:30", closeTime: "22:00" },
    });
    await db.collection("users").insertOne({
      _id: ownerId,
      role: "restaurant_owner",
    });
    for (const collectionName of referencedCollections) {
      await db.collection(collectionName).insertOne({
        _id: new mongoose.Types.ObjectId(),
        restaurantId,
      });
    }
    await db.collection("auditlogs").insertOne({
      _id: new mongoose.Types.ObjectId(),
      targetType: "restaurant",
      targetId: restaurantId,
    });
    await db.collection("carts").createIndex(
      { userId: 1, restaurantId: 1 },
      { unique: true, name: "userId_1_restaurantId_1" }
    );

    const dryRun = await migration.runMigration({ db, dryRun: true, writeFiles: false });
    expect(dryRun.summary).toMatchObject({
      merchantsCreated: 1,
      branchesCreated: 1,
      hubsCreated: 1,
      foodsUpdated: 1,
      ordersUpdated: 1,
      dronesUpdated: 1,
      cartsUpdated: 1,
      auditLogsUpdated: 1,
      usersUpdated: 1,
      cartIndexesChanged: 3,
    });
    expect(await db.collection("merchants").countDocuments()).toBe(0);
    expect(await db.collection("hubs").countDocuments()).toBe(0);

    const applied = await migration.runMigration({
      db,
      dryRun: false,
      phase2Ready: true,
      writeFiles: false,
    });
    const mapping = applied.mappings[0];
    const branchId = new mongoose.Types.ObjectId(mapping.branchId);
    const merchant = await db.collection("merchants").findOne({ _id: restaurantId });
    const branch = await db.collection("branches").findOne({ _id: branchId });
    expect(merchant).toMatchObject({
      type: "individual",
      slug: "bep-viet",
      status: "active",
      ownerUserId: ownerId,
      branchCount: 1,
    });
    expect(branch).toMatchObject({
      merchantId: restaurantId,
      code: "MAIN",
      status: "active",
      location: { type: "Point", coordinates: [106.703, 10.775] },
    });
    expect(branch.operatingHours).toHaveLength(7);

    const cartIndexes = await db.collection("carts").indexes();
    const branchIndex = cartIndexes.find((index) =>
      JSON.stringify(index.key) === JSON.stringify(migration.CART_INDEX_KEY)
    );
    expect(branchIndex).toMatchObject({
      unique: true,
      partialFilterExpression: migration.CART_PARTIAL_FILTER,
    });
    const legacyIndex = cartIndexes.find((index) =>
      JSON.stringify(index.key) === JSON.stringify(migration.CART_LEGACY_INDEX_KEY)
    );
    expect(legacyIndex).toMatchObject({
      unique: true,
      partialFilterExpression: migration.CART_LEGACY_PARTIAL_FILTER,
    });

    for (const collectionName of ["foods", "orders", "carts"]) {
      const migrated = await db.collection(collectionName).findOne({ restaurantId });
      const expected = collectionName === "foods"
        ? { merchantId: restaurantId }
        : { merchantId: restaurantId, branchId };
      expect(migrated).toMatchObject(expected);
    }
    const migratedDrone = await db.collection("drones").findOne({});
    expect(migratedDrone.hubId).toBeDefined();
    expect(migratedDrone.branchId).toBeUndefined();
    expect(await db.collection("hubs").countDocuments()).toBe(1);
    expect(await db.collection("auditlogs").findOne({ targetId: restaurantId }))
      .toMatchObject({ merchantId: restaurantId });
    expect(await db.collection("users").findOne({ _id: ownerId }))
      .toMatchObject({ role: "merchant_owner" });

    const repeated = await migration.runMigration({
      db,
      dryRun: false,
      phase2Ready: true,
      writeFiles: false,
    });
    expect(repeated.summary).toMatchObject({
      merchantsCreated: 0,
      branchesCreated: 0,
      hubsCreated: 0,
      foodsUpdated: 0,
      ordersUpdated: 0,
      dronesUpdated: 0,
      cartsUpdated: 0,
      auditLogsUpdated: 0,
      usersUpdated: 0,
      cartIndexesChanged: 0,
    });
    expect(await db.collection("merchants").countDocuments()).toBe(1);
    expect(await db.collection("branches").countDocuments()).toBe(1);
  });

  it("keeps migrated merchants active and maps the legacy lock to the branch", () => {
    expect(migration.mapLegacyStatus({ isLocked: false })).toEqual({
      merchantStatus: "active",
      branchStatus: "active",
    });
    expect(migration.mapLegacyStatus({ isLocked: true })).toEqual({
      merchantStatus: "active",
      branchStatus: "locked",
    });
  });

  it("allocates deterministic unique slugs through fallback collisions", () => {
    const restaurantId = new mongoose.Types.ObjectId("000000000000000000abcdef");
    const merchantId = restaurantId;
    const owners = new Map([
      ["bep-viet", "another-merchant"],
      ["bep-viet-abcdef", "another-merchant"],
    ]);

    expect(migration.reserveUniqueSlug(
      { _id: restaurantId, name: "Bếp Việt" },
      merchantId,
      owners
    )).toBe("bep-viet-abcdef-2");
  });

  it("writes artifacts before apply and leaves the database untouched if that fails", async () => {
    const db = mongoose.connection.db;
    const restaurantId = new mongoose.Types.ObjectId();
    await db.collection("restaurants").insertOne({
      _id: restaurantId,
      name: "Artifact Guard",
      owner: new mongoose.Types.ObjectId(),
      isLocked: false,
    });

    await expect(migration.runMigration({
      db,
      dryRun: false,
      phase2Ready: true,
      writeFiles: true,
      fsModule: { mkdirSync: () => { throw new Error("read-only output"); } },
    })).rejects.toThrow("read-only output");
    expect(await db.collection("merchants").countDocuments()).toBe(0);
    expect(await db.collection("branches").countDocuments()).toBe(0);
  });

  it("writes mapping and log files and repairs a malformed branch-cart index", async () => {
    const db = mongoose.connection.db;
    const restaurantId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    await db.collection("restaurants").insertOne({
      _id: restaurantId,
      name: "Index Guard",
      owner: ownerId,
      isLocked: true,
    });
    await db.collection("carts").insertOne({
      _id: new mongoose.Types.ObjectId(),
      userId,
      restaurantId,
    });
    await db.collection("carts").createIndex(
      { userId: 1, branchId: 1 },
      { name: "wrong_non_unique_branch_index" }
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "dronefood-migration-"));
    try {
      const result = await migration.runMigration({
        db,
        dryRun: false,
        phase2Ready: true,
        outputDir,
        timestamp: "test-run",
      });
      expect(fs.existsSync(result.artifacts.mappingPath)).toBe(true);
      expect(fs.existsSync(result.artifacts.logPath)).toBe(true);
      const log = JSON.parse(fs.readFileSync(result.artifacts.logPath, "utf8"));
      expect(log.status).toBe("completed");

      const indexes = await db.collection("carts").indexes();
      const branchIndex = indexes.find((index) =>
        JSON.stringify(index.key) === JSON.stringify(migration.CART_INDEX_KEY)
      );
      expect(branchIndex).toMatchObject({
        unique: true,
        partialFilterExpression: migration.CART_PARTIAL_FILTER,
      });
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("expands one legacy daily window without replacing per-day schedules", () => {
    const expanded = migration.normalizeOperatingHours({
      openingHours: { openTime: "08:00", closeTime: "21:30" },
    });
    expect(expanded).toHaveLength(7);
    expect(expanded[0]).toEqual({ day: 0, open: "08:00", close: "21:30" });
    expect(expanded[6]).toEqual({ day: 6, open: "08:00", close: "21:30" });

    const perDay = [{ day: 1, open: "09:00", close: "18:00" }];
    expect(migration.normalizeOperatingHours({ operatingHours: perDay })).toEqual(perDay);
  });
});
