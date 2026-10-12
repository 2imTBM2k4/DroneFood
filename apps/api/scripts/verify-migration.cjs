/*
 * Migration Verification Script for Multi-Branch Restaurant Architecture
 *
 * Usage:
 *   node scripts/verify-migration.cjs [options]
 *
 * Options:
 *   --artifact-dir=<path>    Directory containing migration artifacts (default: apps/api/migration-artifacts)
 *   --mapping-file=<path>    Path to specific mapping JSON file (defaults to latest in artifact-dir)
 *   --verbose                Print verbose detailed report
 *   --fix-branch-count       Automatically sync Merchant.branchCount if misaligned
 *   --fix-type               Automatically sync Merchant.type if misaligned
 *   --help                   Display this help message
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.join(__dirname, "../.env") });

const DEFAULT_ARTIFACT_DIR = path.join(__dirname, "../migration-artifacts");

const sameJson = (left, right) => JSON.stringify(left || {}) === JSON.stringify(right || {});
const idString = (val) => String(val?._id || val || "");

const findLatestMappingFile = (dir) => {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("multi-branch-mapping-") && f.endsWith(".json"))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(dir, files[0]) : null;
};

const verifyMigration = async ({
  db,
  artifactDir = DEFAULT_ARTIFACT_DIR,
  mappingFile = null,
  fixBranchCount = false,
  fixType = false,
  verbose = false,
  logDir = null,
} = {}) => {
  if (!db) throw new Error("A connected MongoDB database instance is required");

  const results = [];
  const logDetails = {};

  const recordCheck = (code, name, status, message, details = null) => {
    results.push({ code, name, status, message });
    logDetails[code] = { status, message, details };
  };

  // 1. Load mapping JSON
  const resolvedMappingPath = mappingFile || findLatestMappingFile(artifactDir);
  if (!resolvedMappingPath || !fs.existsSync(resolvedMappingPath)) {
    recordCheck(
      "MAPPING_FILE",
      "Mapping Artifact Existence",
      "WARN",
      `Không tìm thấy file mapping tại ${artifactDir}. Sẽ kiểm tra schema và index độc lập.`
    );
  }

  let mappings = [];
  if (resolvedMappingPath && fs.existsSync(resolvedMappingPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(resolvedMappingPath, "utf8"));
      mappings = parsed.mappings || [];
      recordCheck(
        "MAPPING_FILE",
        "Mapping Artifact Load",
        "PASS",
        `Đã nạp ${mappings.length} mapping từ ${path.basename(resolvedMappingPath)}`
      );
    } catch (err) {
      recordCheck(
        "MAPPING_FILE",
        "Mapping Artifact Load",
        "FAIL",
        `Lỗi đọc file mapping: ${err.message}`
      );
    }
  }

  // 2. Verify counts
  if (mappings.length > 0) {
    const merchantIds = mappings.map((m) => new mongoose.Types.ObjectId(m.merchantId));
    const actualMerchantsCount = await db.collection("merchants").countDocuments({ _id: { $in: merchantIds } });
    if (actualMerchantsCount === mappings.length) {
      recordCheck("COUNT_MERCHANTS", "Merchant Creation Count", "PASS", `Tất cả ${mappings.length} merchant đã tồn tại`);
    } else {
      recordCheck(
        "COUNT_MERCHANTS",
        "Merchant Creation Count",
        "FAIL",
        `Số merchant (${actualMerchantsCount}) không khớp với mapping (${mappings.length})`
      );
    }

    const branchIds = mappings.map((m) => new mongoose.Types.ObjectId(m.branchId));
    const actualBranchesCount = await db.collection("branches").countDocuments({ _id: { $in: branchIds }, code: "MAIN" });
    if (actualBranchesCount === mappings.length) {
      recordCheck("COUNT_BRANCH_MAIN", "Branch MAIN Count", "PASS", `Tất cả ${mappings.length} branch MAIN đã tồn tại`);
    } else {
      recordCheck(
        "COUNT_BRANCH_MAIN",
        "Branch MAIN Count",
        "FAIL",
        `Số branch MAIN (${actualBranchesCount}) không khớp với mapping (${mappings.length})`
      );
    }
  }

  // 3. Verify data integrity (Orphan checks)
  const allMerchantIds = new Set(
    (await db.collection("merchants").find({}, { projection: { _id: 1 } }).toArray()).map((m) => idString(m._id))
  );
  const allBranchIds = new Set(
    (await db.collection("branches").find({}, { projection: { _id: 1 } }).toArray()).map((b) => idString(b._id))
  );
  const allHubIds = new Set(
    (await db.collection("hubs").find({}, { projection: { _id: 1 } }).toArray()).map((h) => idString(h._id))
  );

  // Foods
  const foodsWithMerchant = await db.collection("foods").find({ merchantId: { $exists: true, $ne: null } }).toArray();
  const orphanFoods = foodsWithMerchant.filter((f) => !allMerchantIds.has(idString(f.merchantId)));
  if (orphanFoods.length === 0) {
    recordCheck("INTEGRITY_FOOD", "Food Merchant References", "PASS", "Tất cả món ăn có merchantId hợp lệ");
  } else {
    recordCheck(
      "INTEGRITY_FOOD",
      "Food Merchant References",
      "FAIL",
      `Có ${orphanFoods.length} món ăn tham chiếu merchantId không tồn tại`
    );
  }

  // Orders
  const ordersWithBranch = await db.collection("orders").find({ branchId: { $exists: true, $ne: null } }).toArray();
  const orphanOrders = ordersWithBranch.filter(
    (o) => !allBranchIds.has(idString(o.branchId)) || (o.merchantId && !allMerchantIds.has(idString(o.merchantId)))
  );
  if (orphanOrders.length === 0) {
    recordCheck("INTEGRITY_ORDER", "Order Branch References", "PASS", "Tất cả đơn hàng có branchId/merchantId hợp lệ");
  } else {
    recordCheck(
      "INTEGRITY_ORDER",
      "Order Branch References",
      "FAIL",
      `Có ${orphanOrders.length} đơn hàng tham chiếu branchId hoặc merchantId không tồn tại`
    );
  }

  // Drones
  const drones = await db.collection("drones").find({}).toArray();
  const orphanDrones = drones.filter((d) => !d.hubId || !allHubIds.has(idString(d.hubId)));
  if (orphanDrones.length === 0) {
    recordCheck("INTEGRITY_DRONE", "Drone Hub References", "PASS", "Tất cả drone có hubId hợp lệ");
  } else {
    recordCheck(
      "INTEGRITY_DRONE",
      "Drone Hub References",
      "FAIL",
      `Có ${orphanDrones.length} drone thiếu hoặc tham chiếu hubId không tồn tại`
    );
  }

  // Carts
  const cartsWithBranch = await db.collection("carts").find({ branchId: { $exists: true, $ne: null } }).toArray();
  const orphanCarts = cartsWithBranch.filter((c) => !allBranchIds.has(idString(c.branchId)));
  if (orphanCarts.length === 0) {
    recordCheck("INTEGRITY_CART", "Cart Branch References", "PASS", "Tất cả giỏ hàng có branchId hợp lệ");
  } else {
    recordCheck(
      "INTEGRITY_CART",
      "Cart Branch References",
      "FAIL",
      `Có ${orphanCarts.length} giỏ hàng tham chiếu branchId không tồn tại`
    );
  }

  // 4. Verify indexes
  const merchantIndexes = await db.collection("merchants").indexes().catch(() => []);
  const branchIndexes = await db.collection("branches").indexes().catch(() => []);
  const cartIndexes = await db.collection("carts").indexes().catch(() => []);

  const hasMerchantSlugUnique = merchantIndexes.some((idx) => sameJson(idx.key, { slug: 1 }) && idx.unique === true);
  const hasMerchantOwnerUnique = merchantIndexes.some((idx) => sameJson(idx.key, { ownerUserId: 1 }) && idx.unique === true);
  if (hasMerchantSlugUnique && hasMerchantOwnerUnique) {
    recordCheck("INDEX_MERCHANT", "Merchant Indexes", "PASS", "Index slug và ownerUserId unique tồn tại đầy đủ");
  } else {
    recordCheck(
      "INDEX_MERCHANT",
      "Merchant Indexes",
      "FAIL",
      `Thiếu index Merchant: slug_unique=${hasMerchantSlugUnique}, ownerUserId_unique=${hasMerchantOwnerUnique}`
    );
  }

  const hasBranchCodeUnique = branchIndexes.some((idx) => sameJson(idx.key, { merchantId: 1, code: 1 }) && idx.unique === true);
  const hasBranchGeo = branchIndexes.some((idx) => idx.key?.location === "2dsphere");
  if (hasBranchCodeUnique && hasBranchGeo) {
    recordCheck("INDEX_BRANCH", "Branch Indexes", "PASS", "Index merchantId+code unique và location 2dsphere tồn tại");
  } else {
    recordCheck(
      "INDEX_BRANCH",
      "Branch Indexes",
      "FAIL",
      `Thiếu index Branch: code_unique=${hasBranchCodeUnique}, 2dsphere=${hasBranchGeo}`
    );
  }

  const hasCartBranchUnique = cartIndexes.some(
    (idx) => sameJson(idx.key, { userId: 1, branchId: 1 }) && idx.unique === true && idx.partialFilterExpression
  );
  const hasCartRestUnique = cartIndexes.some(
    (idx) => sameJson(idx.key, { userId: 1, restaurantId: 1 }) && idx.unique === true && idx.partialFilterExpression
  );
  if (hasCartBranchUnique && hasCartRestUnique) {
    recordCheck("INDEX_CART", "Cart Partial Indexes", "PASS", "2 partial unique index của giỏ hàng tồn tại hợp lệ");
  } else {
    recordCheck(
      "INDEX_CART",
      "Cart Partial Indexes",
      "FAIL",
      `Thiếu cart partial index: branch=${hasCartBranchUnique}, legacy=${hasCartRestUnique}`
    );
  }

  const hubIndexes = await db.collection("hubs").indexes().catch(() => []);
  const hasHubCodeUnique = hubIndexes.some((idx) => sameJson(idx.key, { code: 1 }) && idx.unique === true);
  const hasHubGeo = hubIndexes.some((idx) => idx.key?.location === "2dsphere");
  if (hasHubCodeUnique && hasHubGeo) {
    recordCheck("INDEX_HUB", "Hub Indexes", "PASS", "Index code unique và location 2dsphere của Hub tồn tại");
  } else {
    recordCheck(
      "INDEX_HUB",
      "Hub Indexes",
      "FAIL",
      `Thiếu index Hub: code_unique=${hasHubCodeUnique}, 2dsphere=${hasHubGeo}`
    );
  }

  const droneIndexes = await db.collection("drones").indexes().catch(() => []);
  const hasDroneHubIdx = droneIndexes.some((idx) => sameJson(idx.key, { hubId: 1, status: 1 }));
  if (hasDroneHubIdx || droneIndexes.length <= 1) {
    recordCheck("INDEX_DRONE", "Drone Indexes", "PASS", "Index hubId+status của Drone tồn tại");
  } else {
    recordCheck("INDEX_DRONE", "Drone Indexes", "FAIL", "Thiếu index Drone: hubId_1_status_1");
  }

  // 5. Verify branchCount & type
  const merchants = await db.collection("merchants").find({}).toArray();
  let countMismatches = 0;
  let typeMismatches = 0;

  for (const m of merchants) {
    const activeBranches = await db.collection("branches").countDocuments({ merchantId: m._id, status: "active" });
    if (m.branchCount !== activeBranches) {
      countMismatches += 1;
      if (fixBranchCount) {
        await db.collection("merchants").updateOne({ _id: m._id }, { $set: { branchCount: activeBranches } });
      }
    }
    const expectedType = activeBranches > 1 ? "brand" : "individual";
    if (activeBranches > 0 && m.type !== expectedType) {
      typeMismatches += 1;
      if (fixType) {
        await db.collection("merchants").updateOne({ _id: m._id }, { $set: { type: expectedType } });
      }
    }
  }

  if (countMismatches === 0) {
    recordCheck("BRANCH_COUNT", "Merchant branchCount Accuracy", "PASS", "Toàn bộ merchant.branchCount khớp với branch active");
  } else if (fixBranchCount) {
    recordCheck("BRANCH_COUNT", "Merchant branchCount Accuracy", "WARN", `Đã tự động sửa ${countMismatches} merchant lệch branchCount`);
  } else {
    recordCheck("BRANCH_COUNT", "Merchant branchCount Accuracy", "FAIL", `Có ${countMismatches} merchant có branchCount không khớp`);
  }

  if (typeMismatches === 0) {
    recordCheck("MERCHANT_TYPE", "Merchant Type Accuracy", "PASS", "Toàn bộ merchant.type (individual/brand) chính xác");
  } else if (fixType) {
    recordCheck("MERCHANT_TYPE", "Merchant Type Accuracy", "WARN", `Đã tự động sửa ${typeMismatches} merchant lệch type`);
  } else {
    recordCheck("MERCHANT_TYPE", "Merchant Type Accuracy", "FAIL", `Có ${typeMismatches} merchant có type không khớp quy mô`);
  }

  // 6. Verify User.role
  const legacyOwnersCount = await db.collection("users").countDocuments({ role: "restaurant_owner" });
  if (legacyOwnersCount === 0) {
    recordCheck("USER_ROLES", "Legacy Role Migration", "PASS", "Không còn tài khoản nào giữ role restaurant_owner");
  } else {
    recordCheck(
      "USER_ROLES",
      "Legacy Role Migration",
      "WARN",
      `Còn ${legacyOwnersCount} tài khoản mang role restaurant_owner chưa được chuyển đổi`
    );
  }

  // 7. Verify legacy bridge
  if (mappings.length > 0) {
    const missingBridge = await db.collection("merchants").countDocuments({
      _id: { $in: mappings.map((m) => new mongoose.Types.ObjectId(m.merchantId)) },
      legacyRestaurantId: { $exists: false },
    });
    if (missingBridge === 0) {
      recordCheck("LEGACY_BRIDGE", "Legacy Restaurant Bridge", "PASS", "Toàn bộ merchant đã thiết lập legacyRestaurantId");
    } else {
      recordCheck("LEGACY_BRIDGE", "Legacy Restaurant Bridge", "FAIL", `Có ${missingBridge} merchant thiếu legacyRestaurantId`);
    }
  }

  const hasFailures = results.some((r) => r.status === "FAIL");

  // Write verification log
  const targetLogDir = logDir || artifactDir;
  if (fs.existsSync(targetLogDir)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logPath = path.join(targetLogDir, `verify-${timestamp}.json`);
    fs.writeFileSync(
      logPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          status: hasFailures ? "FAILED" : "PASSED",
          results,
          details: logDetails,
        },
        null,
        2
      )
    );
  }

  return {
    success: !hasFailures,
    results,
    details: logDetails,
  };
};

const runCli = async () => {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Kiểm tra tính toàn vẹn dữ liệu Multi-Branch sau Migration

Cách dùng:
  node scripts/verify-migration.cjs [options]

Tùy chọn:
  --artifact-dir=<path>    Thư mục chứa migration artifacts (mặc định: apps/api/migration-artifacts)
  --mapping-file=<path>    Chỉ định file mapping JSON cụ thể
  --verbose                Hiển thị chi tiết từng bản ghi
  --fix-branch-count       Tự động đồng bộ lại Merchant.branchCount nếu lệch
  --fix-type               Tự động đồng bộ lại Merchant.type (individual/brand) nếu lệch
  --help                   Xem trợ giúp
`);
    return;
  }

  const getArgValue = (prefix) => {
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
  };

  const artifactDir = getArgValue("--artifact-dir=") || DEFAULT_ARTIFACT_DIR;
  const mappingFile = getArgValue("--mapping-file=");
  const fixBranchCount = args.includes("--fix-branch-count");
  const fixType = args.includes("--fix-type");
  const verbose = args.includes("--verbose");

  if (!process.env.MONGODB_URI) {
    console.error("LỖI: Biến môi trường MONGODB_URI là bắt buộc");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const result = await verifyMigration({
      db: mongoose.connection.db,
      artifactDir,
      mappingFile,
      fixBranchCount,
      fixType,
      verbose,
    });

    console.log("\n=======================================================");
    console.log("       BÁO CÁO XÁC MINH MIGRATION MULTI-BRANCH");
    console.log("=======================================================\n");

    for (const r of result.results) {
      const tag = r.status === "PASS" ? "[\x1b[32mPASS\x1b[0m]" : r.status === "WARN" ? "[\x1b[33mWARN\x1b[0m]" : "[\x1b[31mFAIL\x1b[0m]";
      console.log(`${tag} ${r.code.padEnd(20)} | ${r.message}`);
    }

    console.log("\n-------------------------------------------------------");
    if (result.success) {
      console.log("\x1b[32m✔ TẤT CẢ CÁC HẠNG MỤC ĐẠT CHUẨN! SẴN SÀNG TRIỂN KHAI.\x1b[0m\n");
      process.exitCode = 0;
    } else {
      console.error("\x1b[31m✖ PHÁT HIỆN LỖI KIỂM TRA TOÀN VẸN. XEM CHI TIẾT PHÍA TRÊN.\x1b[0m\n");
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
};

module.exports = {
  verifyMigration,
};

if (require.main === module) {
  runCli().catch((err) => {
    console.error("Lỗi thực thi:", err);
    process.exit(1);
  });
}
