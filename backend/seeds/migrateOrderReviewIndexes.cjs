/*
 * Replaces the old one-target-per-type index with a per-food-item index.
 * Run: node seeds/migrateOrderReviewIndexes.cjs          (dry run)
 *      node seeds/migrateOrderReviewIndexes.cjs --apply  (after backup)
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.join(__dirname, "../.env") });
const apply = process.argv.includes("--apply");

async function run() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);
  const reviews = mongoose.connection.collection("orderreviews");
  const exists = await mongoose.connection.db.listCollections({ name: "orderreviews" }).hasNext();
  const indexes = exists ? await reviews.indexes() : [];
  const oldIndex = indexes.find((index) => index.name === "order_1_targetType_1");
  const newIndex = indexes.find((index) => index.name === "order_1_targetType_1_target_1");

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", collectionExists: exists, oldIndexExists: Boolean(oldIndex), newIndexExists: Boolean(newIndex) }));
  if (!apply) return;
  if (oldIndex) await reviews.dropIndex(oldIndex.name);
  if (!newIndex) {
    await reviews.createIndex({ order: 1, targetType: 1, target: 1 }, { unique: true, name: "order_1_targetType_1_target_1" });
  }
}

run()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.connection.close(); });
