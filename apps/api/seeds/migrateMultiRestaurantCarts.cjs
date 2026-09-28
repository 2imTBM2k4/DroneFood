/*
 * Split the legacy one-cart-per-user schema into one cart per restaurant.
 *
 * Run:      node seeds/migrateMultiRestaurantCarts.cjs
 * Apply:    node seeds/migrateMultiRestaurantCarts.cjs --apply
 * Rollback: restore documents from multi_restaurant_cart_migration_backups,
 *           drop userId_1_restaurantId_1, then recreate unique userId_1.
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.join(__dirname, "../.env") });

const migrationId = "multi-restaurant-carts-v1";

const indexKeyEquals = (index, expected) =>
  JSON.stringify(index?.key || {}) === JSON.stringify(expected);

const isLegacyUserOnlyIndex = (index) =>
  index?.unique === true && indexKeyEquals(index, { userId: 1 });

const isUserRestaurantIndex = (index) =>
  index?.unique === true
  && indexKeyEquals(index, { userId: 1, restaurantId: 1 });

const restaurantIdOf = (line) => {
  const value = line?.foodId?.restaurantId;
  if (!value) return null;
  return String(value?._id || value);
};

const deriveLegacyRestaurantId = (cart) => {
  const ids = (cart?.items || []).map(restaurantIdOf).filter(Boolean);
  if (ids.length === 0) return null;
  return ids.every((id) => id === ids[0]) ? ids[0] : null;
};

const classifyLegacyCart = (cart) => {
  const ids = (cart?.items || []).map(restaurantIdOf).filter(Boolean);
  if (ids.length === 0) return { status: "empty" };
  const restaurantId = deriveLegacyRestaurantId(cart);
  if (!restaurantId) return { status: "inconsistent" };
  return { status: "ready", restaurantId };
};

const run = async ({ apply = process.argv.includes("--apply") } = {}) => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });

  try {
    const carts = mongoose.connection.collection("carts");
    const foods = mongoose.connection.collection("foods");
    const backups = mongoose.connection.collection(
      "multi_restaurant_cart_migration_backups"
    );
    const indexes = await carts.indexes();
    const legacyIndexes = indexes.filter(isLegacyUserOnlyIndex);
    const hasUserRestaurantIndex = indexes.some(isUserRestaurantIndex);
    const legacy = await carts
      .find({ restaurantId: { $exists: false } })
      .toArray();
    const foodIds = [
      ...new Set(
        legacy.flatMap((cart) =>
          (cart.items || []).map((line) => String(line.foodId || "")).filter(Boolean)
        )
      ),
    ].filter((id) => mongoose.isValidObjectId(id));
    const foodRows = await foods
      .find({ _id: { $in: foodIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .project({ restaurantId: 1 })
      .toArray();
    const restaurantByFood = new Map(
      foodRows.map((food) => [String(food._id), food.restaurantId])
    );
    const classified = legacy.map((cart) => ({
      cart,
      result: classifyLegacyCart({
        ...cart,
        items: (cart.items || []).map((line) => ({
          ...line,
          foodId: line.foodId
            ? { restaurantId: restaurantByFood.get(String(line.foodId)) }
            : null,
        })),
      }),
    }));
    const counts = classified.reduce(
      (summary, entry) => ({
        ...summary,
        [entry.result.status]: summary[entry.result.status] + 1,
      }),
      { ready: 0, empty: 0, inconsistent: 0 }
    );

    console.log(
      JSON.stringify({
        migrationId,
        mode: apply ? "apply" : "dry-run",
        candidates: legacy.length,
        ...counts,
        legacyUserOnlyUniqueIndex: legacyIndexes.length > 0,
        userRestaurantUniqueIndex: hasUserRestaurantIndex,
      })
    );
    if (!apply) return counts;
    if (counts.inconsistent > 0) {
      throw new Error(
        "Inconsistent legacy carts require manual review before applying migration"
      );
    }

    for (const { cart, result } of classified) {
      await backups.updateOne(
        { migrationId, cartId: cart._id },
        {
          $setOnInsert: {
            migrationId,
            cartId: cart._id,
            document: cart,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
      if (result.status === "empty") {
        await carts.deleteOne({ _id: cart._id, restaurantId: { $exists: false } });
      } else {
        await carts.updateOne(
          { _id: cart._id, restaurantId: { $exists: false } },
          { $set: { restaurantId: new mongoose.Types.ObjectId(result.restaurantId) } }
        );
      }
    }

    const remaining = await carts.countDocuments({
      restaurantId: { $exists: false },
    });
    if (remaining > 0) {
      throw new Error(`${remaining} carts still have no restaurantId`);
    }

    for (const index of legacyIndexes) {
      await carts.dropIndex(index.name);
    }
    if (!hasUserRestaurantIndex) {
      await carts.createIndex(
        { userId: 1, restaurantId: 1 },
        { unique: true, name: "userId_1_restaurantId_1" }
      );
    }
    return counts;
  } finally {
    await mongoose.connection.close();
  }
};

module.exports = {
  classifyLegacyCart,
  deriveLegacyRestaurantId,
  isLegacyUserOnlyIndex,
  isUserRestaurantIndex,
  run,
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
