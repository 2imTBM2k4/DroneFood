/*
 * Rollback Script for Multi-Branch Restaurant Migration
 *
 * Usage:
 *   node scripts/rollback-migration.cjs [options]
 *
 * Options:
 *   --artifact-dir=<path>    Directory containing migration artifacts (default: apps/api/migration-artifacts)
 *   --mapping-file=<path>    Path to specific mapping JSON file (defaults to latest)
 *   --confirm                MANDATORY to perform real database changes; without it, runs in dry-run mode
 *   --help                   Display this help message
 *
 * WARNING:
 *   This script deletes created Merchants and Branches and rolls back field migrations.
 *   Only run if migration failed immediately and no post-migration operational data was created.
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.join(__dirname, "../.env") });

const DEFAULT_ARTIFACT_DIR = path.join(__dirname, "../migration-artifacts");

const findLatestMappingFile = (dir) => {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("multi-branch-mapping-") && f.endsWith(".json"))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(dir, files[0]) : null;
};

const rollbackMigration = async ({
  db,
  artifactDir = DEFAULT_ARTIFACT_DIR,
  mappingFile = null,
  confirm = false,
  logDir = null,
} = {}) => {
  if (!db) throw new Error("A connected MongoDB database instance is required");

  const resolvedMappingPath = mappingFile || findLatestMappingFile(artifactDir);
  if (!resolvedMappingPath || !fs.existsSync(resolvedMappingPath)) {
    throw new Error(`Không tìm thấy file mapping JSON tại ${artifactDir} để thực hiện rollback.`);
  }

  const parsed = JSON.parse(fs.readFileSync(resolvedMappingPath, "utf8"));
  const mappings = parsed.mappings || [];
  if (mappings.length === 0) {
    return {
      success: true,
      mode: confirm ? "apply" : "dry-run",
      summary: { message: "File mapping rỗng, không có dữ liệu cần rollback." },
    };
  }

  const merchantIds = mappings.map((m) => new mongoose.Types.ObjectId(m.merchantId));
  const branchIds = mappings.map((m) => new mongoose.Types.ObjectId(m.branchId));
  const oldRestaurantIds = mappings.map((m) => new mongoose.Types.ObjectId(m.oldRestaurantId));

  const defaultHub = await db.collection("hubs").findOne({ code: "HUB-DEFAULT" });
  const defaultHubId = defaultHub?._id;

  const plan = {
    merchantsToDelete: await db.collection("merchants").countDocuments({ _id: { $in: merchantIds } }),
    branchesToDelete: await db.collection("branches").countDocuments({ _id: { $in: branchIds } }),
    hubsToDelete: defaultHubId ? 1 : 0,
    foodsToReset: await db.collection("foods").countDocuments({ merchantId: { $in: merchantIds } }),
    ordersToReset: await db.collection("orders").countDocuments({
      $or: [{ merchantId: { $in: merchantIds } }, { branchId: { $in: branchIds } }],
    }),
    dronesToReset: await db.collection("drones").countDocuments({
      $or: [
        { hubId: defaultHubId || new mongoose.Types.ObjectId() },
        { branchId: { $in: branchIds } },
      ],
    }),
    cartsToReset: await db.collection("carts").countDocuments({
      $or: [{ branchId: { $in: branchIds } }, { merchantId: { $in: merchantIds } }],
    }),
    usersToRestoreRole: 0,
  };

  // Find users who were merchant_owner for these merchants
  const merchants = await db.collection("merchants").find({ _id: { $in: merchantIds } }).toArray();
  const ownerIds = [...new Set(merchants.map((m) => m.ownerUserId).filter(Boolean))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  if (ownerIds.length > 0) {
    plan.usersToRestoreRole = await db.collection("users").countDocuments({
      _id: { $in: ownerIds },
      role: "merchant_owner",
    });
  }

  if (!confirm) {
    return {
      success: true,
      mode: "dry-run",
      mappingFile: resolvedMappingPath,
      plan,
      message: "Đang chạy ở chế độ xem trước (Dry-run). Truyền cờ --confirm để thực thi rollback thật.",
    };
  }

  // APPLY MODE
  const executionSummary = { ...plan };

  // 1. Delete created branches, merchants & default hub
  await db.collection("branches").deleteMany({ _id: { $in: branchIds } });
  await db.collection("merchants").deleteMany({ _id: { $in: merchantIds } });
  if (defaultHubId) {
    await db.collection("hubs").deleteOne({ _id: defaultHubId });
  }

  // 2. Reset dependent collections
  await db.collection("foods").updateMany(
    { merchantId: { $in: merchantIds } },
    { $unset: { merchantId: "" } }
  );

  await db.collection("orders").updateMany(
    { $or: [{ merchantId: { $in: merchantIds } }, { branchId: { $in: branchIds } }] },
    { $unset: { merchantId: "", branchId: "" } }
  );

  await db.collection("drones").updateMany(
    { $or: [{ hubId: defaultHubId || new mongoose.Types.ObjectId() }, { branchId: { $in: branchIds } }] },
    { $unset: { hubId: "", branchId: "", restaurantId: "" } }
  );

  await db.collection("carts").updateMany(
    { $or: [{ branchId: { $in: branchIds } }, { merchantId: { $in: merchantIds } }] },
    { $unset: { branchId: "", merchantId: "" } }
  );

  // 3. Restore user roles
  if (ownerIds.length > 0) {
    await db.collection("users").updateMany(
      { _id: { $in: ownerIds }, role: "merchant_owner" },
      { $set: { role: "restaurant_owner" } }
    );
  }

  // 4. Write rollback log
  const targetLogDir = logDir || artifactDir;
  let logPath = null;
  if (fs.existsSync(targetLogDir)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    logPath = path.join(targetLogDir, `rollback-log-${timestamp}.json`);
    fs.writeFileSync(
      logPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          status: "COMPLETED",
          mappingFile: resolvedMappingPath,
          executionSummary,
        },
        null,
        2
      )
    );
  }

  return {
    success: true,
    mode: "apply",
    mappingFile: resolvedMappingPath,
    executionSummary,
    logPath,
  };
};

const runCli = async () => {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Hoàn nguyên Migration Multi-Branch (Rollback Script)

Cách dùng:
  node scripts/rollback-migration.cjs [options]

Tùy chọn:
  --artifact-dir=<path>    Thư mục chứa migration artifacts (mặc định: apps/api/migration-artifacts)
  --mapping-file=<path>    Chỉ định file mapping JSON cụ thể
  --confirm                BẮT BUỘC để thực thi rollback thật (không có sẽ chỉ chạy dry-run)
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
  const confirm = args.includes("--confirm");

  if (!process.env.MONGODB_URI) {
    console.error("LỖI: Biến môi trường MONGODB_URI là bắt buộc");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const result = await rollbackMigration({
      db: mongoose.connection.db,
      artifactDir,
      mappingFile,
      confirm,
    });

    console.log("\n=======================================================");
    console.log(`       KẾT QUẢ ROLLBACK MIGRATION (${result.mode.toUpperCase()})`);
    console.log("=======================================================\n");

    console.log("File mapping sử dụng:", result.mappingFile);
    console.log("\nChi tiết dữ liệu hoàn nguyên:");
    console.log(JSON.stringify(result.executionSummary || result.plan, null, 2));

    if (!confirm) {
      console.log("\n\x1b[33m[CHÚ Ý] Đây chỉ là xem trước. Để thực thi thật, hãy truyền thêm cờ --confirm\x1b[0m\n");
    } else {
      console.log("\n\x1b[32m✔ ROLLBACK HOÀN TẤT THÀCH CÔNG! ĐÃ TRẢ DATABASE VỀ TRẠNG THÁI CŨ.\x1b[0m\n");
    }
  } finally {
    await mongoose.disconnect();
  }
};

module.exports = {
  rollbackMigration,
};

if (require.main === module) {
  runCli().catch((err) => {
    console.error("Lỗi thực thi:", err);
    process.exit(1);
  });
}
