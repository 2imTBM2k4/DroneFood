/*
 * Replaces the legacy unique `order_1` index, which allowed one redemption
 * per order, with the current one-redemption-per-voucher-per-order index.
 *
 * Run dry-run first:
 *   npm.cmd run migrate:voucher-redemption-index
 * Then, after the output is reviewed/backed up:
 *   npm.cmd run migrate:voucher-redemption-index -- --apply
 */
require("dotenv").config();
const mongoose = require("mongoose");

const apply = process.argv.includes("--apply");

const isLegacyOrderOnlyUniqueIndex = (index) =>
  index.name === "order_1" &&
  index.unique === true &&
  JSON.stringify(index.key) === JSON.stringify({ order: 1 });

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");

  mongoose.set("autoIndex", false);
  await mongoose.connect(uri);
  const collectionExists = await mongoose.connection.db
    .listCollections({ name: "voucherredemptions" })
    .hasNext();
  const redemptions = mongoose.connection.collection("voucherredemptions");
  const indexes = collectionExists ? await redemptions.indexes() : [];
  const legacyIndex = indexes.find(isLegacyOrderOnlyUniqueIndex);
  const compoundIndex = indexes.find(
    (index) =>
      index.unique === true &&
      JSON.stringify(index.key) === JSON.stringify({ order: 1, voucher: 1 })
  );

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    collectionExists,
    legacyOrderOnlyUniqueIndex: Boolean(legacyIndex),
    compoundOrderVoucherUniqueIndex: Boolean(compoundIndex),
  }));
  if (!apply) return;

  if (legacyIndex) await redemptions.dropIndex(legacyIndex.name);
  if (!compoundIndex) {
    await redemptions.createIndex(
      { order: 1, voucher: 1 },
      { unique: true, name: "order_1_voucher_1" }
    );
  }
  console.log("Voucher redemption indexes are ready for multiple voucher codes per order.");
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
