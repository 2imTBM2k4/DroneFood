/*
 * Migrate legacy Restaurant data to Merchant + Branch.
 * Preview: node seeds/migrate-to-multi-branch.cjs [--dry-run]
 * Apply:   node seeds/migrate-to-multi-branch.cjs --apply --phase2-ready
 */
const { deriveBranchId, mapLegacyStatus, normalizeOperatingHours, buildAddress, buildLocation, buildMerchantDocument, buildBranchDocument } = require("../utils/legacyBranchMapping.cjs");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.join(__dirname, "../.env") });

const MIGRATION_ID = "multi-branch-restaurant-v1";
const MAIN_BRANCH_CODE = "MAIN";
const DEFAULT_ARTIFACT_DIR = path.join(__dirname, "../migration-artifacts");
const CART_INDEX_KEY = { userId: 1, branchId: 1 };
const CART_PARTIAL_FILTER = {
  userId: { $type: "objectId" },
  branchId: { $type: "objectId" },
};
const CART_LEGACY_INDEX_KEY = { userId: 1, restaurantId: 1 };
const CART_LEGACY_PARTIAL_FILTER = {
  userId: { $type: "objectId" },
  restaurantId: { $type: "objectId" },
};

const idString = (value) => String(value?._id || value || "");
const sameJson = (left, right) => JSON.stringify(left || {}) === JSON.stringify(right || {});
const indexKeyEquals = (index, expected) => sameJson(index?.key, expected);
const collectionExists = async (db, name) =>
  (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;

const slugify = (value = "") => {
  const slug = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "merchant";
};

const reserveUniqueSlug = (restaurant, merchantId, slugOwners) => {
  const merchantKey = idString(merchantId);
  const base = slugify(restaurant?.name);
  const suffix = idString(restaurant?._id).slice(-6) || "legacy";
  for (let attempt = 0; attempt < 10000; attempt += 1) {
    const candidate = attempt === 0
      ? base
      : attempt === 1
        ? `${base}-${suffix}`
        : `${base}-${suffix}-${attempt}`;
    const owner = slugOwners.get(candidate);
    if (!owner || owner === merchantKey) {
      slugOwners.set(candidate, merchantKey);
      return candidate;
    }
  }
  throw new Error(`Could not allocate a unique slug for restaurant ${idString(restaurant?._id)}`);
};

const requiredEntityIndexes = {
  merchants: [
    { key: { slug: 1 }, options: { unique: true, name: "slug_1" } },
    { key: { ownerUserId: 1 }, options: { unique: true, name: "ownerUserId_1" } },
    { key: { status: 1, type: 1 }, options: { name: "status_1_type_1" } },
    { key: { legacyRestaurantId: 1 }, options: { name: "legacyRestaurantId_1" } },
  ],
  branches: [
    { key: { merchantId: 1, code: 1 }, options: { unique: true, name: "merchantId_1_code_1" } },
    { key: { location: "2dsphere" }, options: { name: "location_2dsphere" } },
    { key: { merchantId: 1, isOpen: 1, status: 1 }, options: { name: "merchantId_1_isOpen_1_status_1" } },
  ],
  hubs: [
    { key: { code: 1 }, options: { unique: true, name: "code_1" } },
    { key: { location: "2dsphere" }, options: { name: "location_2dsphere" } },
    { key: { status: 1 }, options: { name: "status_1" } },
  ],
  drones: [
    { key: { hubId: 1, status: 1 }, options: { name: "hubId_1_status_1" } },
    { key: { status: 1, batteryLevel: -1 }, options: { name: "status_1_batteryLevel_-1" } },
  ],
};
const isExactIndex = (index, definition) => {
  if (!indexKeyEquals(index, definition.key)) return false;
  if (Boolean(index.unique) !== Boolean(definition.options.unique)) return false;
  const expectedPartial = definition.options.partialFilterExpression;
  if (expectedPartial && !sameJson(index.partialFilterExpression, expectedPartial)) return false;
  if (!expectedPartial && index.partialFilterExpression) return false;
  return true;
};

const getIndexes = async (db, name) =>
  (await collectionExists(db, name)) ? db.collection(name).indexes() : [];

const planIndexChanges = async (db, hasMappings) => {
  if (!hasMappings) return [];
  const changes = [];
  for (const [collectionName, definitions] of Object.entries(requiredEntityIndexes)) {
    const indexes = await getIndexes(db, collectionName);
    for (const definition of definitions) {
      const sameKey = indexes.find((index) => indexKeyEquals(index, definition.key));
      if (!isExactIndex(sameKey, definition)) {
        if (sameKey && sameKey.name !== "_id_") {
          changes.push({ action: "drop-index", collectionName, name: sameKey.name, category: "entity" });
        }
        changes.push({ action: "create-index", collectionName, ...definition, category: "entity" });
      }
    }
  }
  const cartIndexes = await getIndexes(db, "carts");
  const desired = {
    key: CART_INDEX_KEY,
    options: {
      unique: true,
      name: "userId_1_branchId_1",
      partialFilterExpression: CART_PARTIAL_FILTER,
    },
  };
  const sameCartKey = cartIndexes.find((index) => indexKeyEquals(index, CART_INDEX_KEY));
  if (!isExactIndex(sameCartKey, desired)) {
    if (sameCartKey && sameCartKey.name !== "_id_") {
      changes.push({ action: "drop-index", collectionName: "carts", name: sameCartKey.name, category: "cart-new" });
    }
    changes.push({ action: "create-index", collectionName: "carts", ...desired, category: "cart-new" });
  }

  const desiredLegacy = {
    key: CART_LEGACY_INDEX_KEY,
    options: {
      unique: true,
      name: "userId_1_restaurantId_1",
      partialFilterExpression: CART_LEGACY_PARTIAL_FILTER,
    },
  };
  const sameLegacyCartKey = cartIndexes.find((index) => indexKeyEquals(index, CART_LEGACY_INDEX_KEY));
  if (!isExactIndex(sameLegacyCartKey, desiredLegacy)) {
    if (sameLegacyCartKey && sameLegacyCartKey.name !== "_id_") {
      changes.push({ action: "drop-index", collectionName: "carts", name: sameLegacyCartKey.name, category: "cart-legacy" });
    }
    changes.push({ action: "create-index", collectionName: "carts", ...desiredLegacy, category: "cart-legacy" });
  }

  const droneIndexes = await getIndexes(db, "drones");
  for (const index of droneIndexes) {
    if (index.key && (index.key.branchId !== undefined || index.key.restaurantId !== undefined)) {
      if (index.name !== "_id_") {
        changes.push({ action: "drop-index", collectionName: "drones", name: index.name, category: "drone-legacy" });
      }
    }
  }

  return changes;
};

const writeArtifacts = ({ fsModule, outputDir, timestamp, mappings, changes, mode, status }) => {
  fsModule.mkdirSync(outputDir, { recursive: true });
  const mappingPath = path.join(outputDir, `multi-branch-mapping-${timestamp}.json`);
  const logPath = path.join(outputDir, `migration-log-${timestamp}.json`);
  fsModule.writeFileSync(mappingPath, `${JSON.stringify({ migrationId: MIGRATION_ID, mappings }, null, 2)}\n`);
  fsModule.writeFileSync(logPath, `${JSON.stringify({ migrationId: MIGRATION_ID, mode, status, changes }, null, 2)}\n`);
  return { mappingPath, logPath };
};

const applyIndexChanges = async (db, changes) => {
  const priority = { "drone-legacy": 0, "cart-new": 1, entity: 2, "cart-legacy": 3 };
  const sorted = [...changes].sort((a, b) => {
    const diff = priority[a.category] - priority[b.category];
    if (diff !== 0) return diff;
    if (a.action === "drop-index" && b.action !== "drop-index") return -1;
    if (a.action !== "drop-index" && b.action === "drop-index") return 1;
    return 0;
  });
  for (const change of sorted) {
    const collection = db.collection(change.collectionName);
    if (change.action === "drop-index") await collection.dropIndex(change.name);
    else await collection.createIndex(change.key, change.options);
  }
};

const runMigration = async ({
  db,
  dryRun = true,
  phase2Ready = false,
  writeFiles = true,
  outputDir = DEFAULT_ARTIFACT_DIR,
  fsModule = fs,
  timestamp = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) => {
  if (!db) throw new Error("A connected MongoDB database is required");
  if (!dryRun && !phase2Ready) throw new Error("Apply requires phase2Ready=true because owner roles change");
  const restaurants = (await collectionExists(db, "restaurants"))
    ? await db.collection("restaurants").find({}).toArray() : [];
  const existingMerchants = (await collectionExists(db, "merchants"))
    ? await db.collection("merchants").find({}).toArray() : [];
  const existingBranches = (await collectionExists(db, "branches"))
    ? await db.collection("branches").find({}).toArray() : [];
  const merchantById = new Map(existingMerchants.map((row) => [idString(row._id), row]));
  const branchById = new Map(existingBranches.map((row) => [idString(row._id), row]));
  const slugOwners = new Map(existingMerchants.filter((row) => row.slug).map((row) => [row.slug, idString(row._id)]));
  const mappings = [];
  const mappingByRestaurant = new Map();
  const changes = [];
  const summary = {
    restaurants: restaurants.length, skippedRestaurants: 0,
    merchantsCreated: 0, branchesCreated: 0, hubsCreated: 0,
    foodsUpdated: 0, ordersUpdated: 0, dronesUpdated: 0, cartsUpdated: 0,
    auditLogsUpdated: 0, usersUpdated: 0,
    entityIndexesChanged: 0, cartIndexesChanged: 0,
  };

  for (const restaurant of restaurants) {
    if (!restaurant.owner) {
      summary.skippedRestaurants += 1;
      changes.push({ collection: "restaurants", documentId: idString(restaurant._id), action: "skip", reason: "missing owner" });
      continue;
    }
    const merchantId = restaurant._id;
    const branchId = deriveBranchId(restaurant._id);
    const existingMerchant = merchantById.get(idString(merchantId));
    const existingBranch = branchById.get(idString(branchId));
    if (existingMerchant && idString(existingMerchant.ownerUserId) !== idString(restaurant.owner)) {
      throw new Error(`Merchant ${idString(merchantId)} belongs to a different owner`);
    }
    if (existingBranch && idString(existingBranch.merchantId) !== idString(merchantId)) {
      throw new Error(`Branch ${idString(branchId)} belongs to a different merchant`);
    }
    const slug = existingMerchant?.slug || reserveUniqueSlug(restaurant, merchantId, slugOwners);
    const statuses = mapLegacyStatus(restaurant);
    const mapping = {
      oldRestaurantId: idString(restaurant._id), merchantId: idString(merchantId),
      branchId: idString(branchId), merchantStatus: statuses.merchantStatus,
      branchStatus: statuses.branchStatus,
      merchantDocument: buildMerchantDocument(restaurant, slug),
      branchDocument: buildBranchDocument(restaurant, merchantId, branchId),
    };
    mappings.push(mapping);
    mappingByRestaurant.set(mapping.oldRestaurantId, { merchantId, branchId, ownerUserId: restaurant.owner });
    if (!existingMerchant) {
      summary.merchantsCreated += 1;
      changes.push({ collection: "merchants", documentId: mapping.merchantId, action: "insert" });
    }
    if (!existingBranch) {
      summary.branchesCreated += 1;
      changes.push({ collection: "branches", documentId: mapping.branchId, action: "insert" });
    }
  }

  const ids = [...mappingByRestaurant.keys()].map((id) => new mongoose.Types.ObjectId(id));
  const specs = [
    ["foods", ["merchantId"], "foodsUpdated"],
    ["orders", ["merchantId", "branchId"], "ordersUpdated"],
    ["carts", ["merchantId", "branchId"], "cartsUpdated"],
  ];
  for (const [collectionName, fields, summaryKey] of specs) {
    if (ids.length === 0 || !(await collectionExists(db, collectionName))) continue;
    const rows = await db.collection(collectionName).find({ restaurantId: { $in: ids } }).toArray();
    for (const row of rows) {
      const mapping = mappingByRestaurant.get(idString(row.restaurantId));
      const set = {};
      for (const field of fields) if (row[field] == null) set[field] = mapping[field];
      if (Object.keys(set).length) {
        summary[summaryKey] += 1;
        changes.push({ collection: collectionName, documentId: idString(row._id), action: "update", set });
      }
    }
  }

  const DEFAULT_HUB_CODE = "HUB-DEFAULT";
  const defaultHubLat = Number(process.env.HUB_DEFAULT_LAT) || 10.7769;
  const defaultHubLng = Number(process.env.HUB_DEFAULT_LNG) || 106.7009;
  let defaultHubId = null;
  let defaultHubDoc = null;

  const dronesExist = await collectionExists(db, "drones");
  const dronesToMigrate = dronesExist
    ? await db.collection("drones").find({ hubId: { $exists: false } }).toArray()
    : [];

  if (dronesToMigrate.length > 0) {
    const existingHub = (await collectionExists(db, "hubs"))
      ? (await db.collection("hubs").findOne({ code: DEFAULT_HUB_CODE })) ||
        (await db.collection("hubs").findOne({}))
      : null;

    if (existingHub) {
      defaultHubId = existingHub._id;
    } else {
      defaultHubId = new mongoose.Types.ObjectId();
      defaultHubDoc = {
        _id: defaultHubId,
        name: "Hub mặc định",
        code: DEFAULT_HUB_CODE,
        address: {
          text: "Trung tâm điều hành Drone TP.HCM",
          lat: defaultHubLat,
          lng: defaultHubLng,
        },
        location: {
          type: "Point",
          coordinates: [defaultHubLng, defaultHubLat],
        },
        status: "active",
        capacity: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      summary.hubsCreated += 1;
      changes.push({
        collection: "hubs",
        documentId: idString(defaultHubId),
        action: "insert",
      });
    }

    for (const drone of dronesToMigrate) {
      summary.dronesUpdated += 1;
      changes.push({
        collection: "drones",
        documentId: idString(drone._id),
        action: "update",
        set: { hubId: defaultHubId },
        unset: { branchId: "", restaurantId: "" },
      });
    }
  }
  if (await collectionExists(db, "auditlogs")) {
    const rows = await db.collection("auditlogs").find({ targetType: { $in: ["Restaurant", "restaurant"] }, merchantId: { $exists: false } }).toArray();
    for (const row of rows) {
      const mapping = mappingByRestaurant.get(idString(row.targetId));
      if (!mapping) continue;
      summary.auditLogsUpdated += 1;
      changes.push({ collection: "auditlogs", documentId: idString(row._id), action: "update", set: { merchantId: mapping.merchantId, branchId: mapping.branchId } });
    }
  }
  if (await collectionExists(db, "users")) {
    const ownerIds = [...new Set([...mappingByRestaurant.values()].map((item) => idString(item.ownerUserId)))].map((id) => new mongoose.Types.ObjectId(id));
    if (ownerIds.length) {
      const owners = await db.collection("users").find({ _id: { $in: ownerIds }, role: "restaurant_owner" }).toArray();
      for (const owner of owners) {
        summary.usersUpdated += 1;
        changes.push({ collection: "users", documentId: idString(owner._id), action: "update", set: { role: "merchant_owner" } });
      }
    }
  }

  const indexChanges = await planIndexChanges(db, mappings.length > 0);
  summary.entityIndexesChanged = indexChanges.filter((change) => change.category === "entity").length;
  summary.cartIndexesChanged = indexChanges.filter((change) => change.category?.startsWith("cart")).length;
  changes.push(...indexChanges.map((change) => ({ collection: change.collectionName, action: change.action, name: change.name || change.options?.name })));
  const publicMappings = mappings.map(({ merchantDocument, branchDocument, ...mapping }) => mapping);
  let artifacts = null;
  if (writeFiles) {
    artifacts = writeArtifacts({ fsModule, outputDir, timestamp, mappings: publicMappings, changes, mode: dryRun ? "dry-run" : "apply", status: "planned" });
  }
  if (!dryRun) {
    if (defaultHubDoc) {
      await db.collection("hubs").updateOne(
        { _id: defaultHubDoc._id },
        { $setOnInsert: defaultHubDoc },
        { upsert: true }
      );
    }
    for (const mapping of mappings) {
      await db.collection("merchants").updateOne({ _id: new mongoose.Types.ObjectId(mapping.merchantId) }, { $setOnInsert: mapping.merchantDocument }, { upsert: true });
      await db.collection("branches").updateOne({ _id: new mongoose.Types.ObjectId(mapping.branchId) }, { $setOnInsert: mapping.branchDocument }, { upsert: true });
    }
    for (const change of changes) {
      if (change.action !== "update" || !change.documentId) continue;
      const updateDoc = {};
      if (change.set && Object.keys(change.set).length) updateDoc.$set = change.set;
      if (change.unset && Object.keys(change.unset).length) updateDoc.$unset = change.unset;
      if (Object.keys(updateDoc).length) {
        await db.collection(change.collection).updateOne(
          { _id: new mongoose.Types.ObjectId(change.documentId) },
          updateDoc
        );
      }
    }
    await applyIndexChanges(db, indexChanges);
    if (writeFiles) artifacts = writeArtifacts({ fsModule, outputDir, timestamp, mappings: publicMappings, changes, mode: "apply", status: "completed" });
  }
  return { summary, mappings: publicMappings, changes, artifacts };
};

const runCli = async () => {
  const apply = process.argv.includes("--apply");
  const explicitDryRun = process.argv.includes("--dry-run");
  const phase2Ready = process.argv.includes("--phase2-ready");
  if (apply && explicitDryRun) throw new Error("Choose either --dry-run or --apply");
  if (apply && !phase2Ready) throw new Error("Refusing to apply before Phase 2. Pass --apply --phase2-ready after compatible APIs are deployed.");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  try {
    const result = await runMigration({ db: mongoose.connection.db, dryRun: !apply, phase2Ready });
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...result.summary, artifacts: result.artifacts }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

module.exports = {
  CART_INDEX_KEY, CART_PARTIAL_FILTER,
  CART_LEGACY_INDEX_KEY, CART_LEGACY_PARTIAL_FILTER,
  buildBranchDocument, buildMerchantDocument, deriveBranchId, mapLegacyStatus,
  normalizeOperatingHours, reserveUniqueSlug, runMigration,
};

if (require.main === module) {
  runCli().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
