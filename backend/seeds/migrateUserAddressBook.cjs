/*
 * Week 4 address-book compatibility migration.
 *
 * Scope: users with an old `address` object and no saved `addressBook` entry.
 * Run:   node seeds/migrateUserAddressBook.cjs          # dry run
 *        node seeds/migrateUserAddressBook.cjs --apply  # after a database backup
 * Rollback: restore the matching records from `address_book_migration_backups`
 *           by migrationId. The legacy `address` field is never removed here.
 */
const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.join(__dirname, "../.env") });

const apply = process.argv.includes("--apply");
const migrationId = "user-address-book-v1";

const isFiniteCoordinate = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const makeEntry = (user) => {
  const legacy = user.address || {};
  const recipient = String(legacy.fullName || user.name || "").trim();
  const phone = String(legacy.phone || user.phone || "").trim();
  const street = String(legacy.address || "").trim();
  const city = String(legacy.city || "").trim();
  const state = String(legacy.state || "").trim();
  const country = String(legacy.country || "").trim();
  if (!recipient || !phone || !street || !city || !state || !country
    || !isFiniteCoordinate(legacy.lat, -90, 90) || !isFiniteCoordinate(legacy.lng, -180, 180)) {
    return null;
  }
  return {
    _id: new mongoose.Types.ObjectId(),
    label: "Địa chỉ cũ",
    recipient,
    phone,
    address: street,
    city,
    state,
    country,
    zipCode: String(legacy.zipCode || "").trim(),
    lat: legacy.lat,
    lng: legacy.lng,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

async function run() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection("users");
  const backups = mongoose.connection.collection("address_book_migration_backups");
  const candidates = await users.find({
    $or: [{ addressBook: { $exists: false } }, { addressBook: { $size: 0 } }],
    "address.address": { $type: "string", $ne: "" },
  }).toArray();
  const ready = candidates.map((user) => ({ user, entry: makeEntry(user) }));
  const valid = ready.filter((item) => item.entry);
  const skipped = ready.length - valid.length;

  console.log(JSON.stringify({ migrationId, mode: apply ? "apply" : "dry-run", candidates: candidates.length, ready: valid.length, skippedIncomplete: skipped }));
  if (!apply) return;

  // A backup document contains only the affected fields and is needed for a
  // recoverable rollback. Do not print address or coordinate values.
  for (const { user, entry } of valid) {
    const backupId = crypto.randomUUID();
    await backups.insertOne({ migrationId, backupId, userId: user._id, previousAddressBook: user.addressBook || [], createdAt: new Date() });
    await users.updateOne(
      { _id: user._id, $or: [{ addressBook: { $exists: false } }, { addressBook: { $size: 0 } }] },
      { $set: { addressBook: [entry] } },
    );
  }
  const migrated = await users.countDocuments({ "addressBook.0": { $exists: true } });
  console.log(JSON.stringify({ migrationId, migratedAddressBooks: migrated, skippedIncomplete: skipped }));
}

run()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.connection.close(); });
