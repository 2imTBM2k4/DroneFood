/*
 * One-time, reversible production migration.
 *
 * Legacy data was stored in USD without a currency field. This converts every
 * monetary value to whole VND using the approved fixed rate, while preserving
 * the raw financial values in currency_migration_backups for recovery.
 *
 * Usage:
 *   node seeds/migrateUsdToVnd.cjs          # preview only
 *   node seeds/migrateUsdToVnd.cjs --apply  # execute once
 */
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const { Food, Order, User, Restaurant, Cart } = require("../models/index.cjs");
const DroneDeliveryHistory = require("../models/droneDeliveryHistoryModel.cjs");

dotenv.config({ path: path.join(__dirname, "../.env") });

const USD_TO_VND = 26059.99;
const MIGRATION_ID = "usd-to-vnd-26059.99-v1";
const apply = process.argv.includes("--apply");
const roundVnd = (value) => Math.round(value * USD_TO_VND);
const monetary = (value) => typeof value === "number" && Number.isFinite(value);

const convertOptionGroups = (groups = []) =>
  groups.map((group) => ({
    ...group,
    options: (group.options || []).map((option) => ({
      ...option,
      ...(monetary(option.priceDelta) && { priceDelta: roundVnd(option.priceDelta) }),
    })),
  }));

const convertOrderItems = (items = []) =>
  items.map((item) => ({
    ...item,
    ...(monetary(item.price) && { price: roundVnd(item.price) }),
    selectedOptions: (item.selectedOptions || []).map((option) => ({
      ...option,
      ...(monetary(option.priceDelta) && { priceDelta: roundVnd(option.priceDelta) }),
    })),
  }));

const backup = (docs) => ({
  foods: docs.foods.map(({ _id, price, optionGroups }) => ({ _id, price, optionGroups })),
  orders: docs.orders.map(({
    _id, currency, orderItems, itemsPrice, serviceFee, taxPrice, shippingPrice, totalPrice,
  }) => ({ _id, currency, orderItems, itemsPrice, serviceFee, taxPrice, shippingPrice, totalPrice })),
  carts: docs.carts.map(({ _id, items }) => ({ _id, items })),
  users: docs.users.map(({ _id, balance }) => ({ _id, balance })),
  restaurants: docs.restaurants.map(({ _id, balance }) => ({ _id, balance })),
  droneHistories: docs.droneHistories.map(({ _id, totalPrice }) => ({ _id, totalPrice })),
});

const updates = (docs) => ({
  foods: docs.foods.map((food) => ({
    updateOne: {
      filter: { _id: food._id },
      update: { $set: { price: roundVnd(food.price), optionGroups: convertOptionGroups(food.optionGroups) } },
    },
  })),
  orders: docs.orders.map((order) => {
    const fields = { currency: "VND", orderItems: convertOrderItems(order.orderItems) };
    ["itemsPrice", "serviceFee", "taxPrice", "shippingPrice", "totalPrice"].forEach((field) => {
      if (monetary(order[field])) fields[field] = roundVnd(order[field]);
    });
    return { updateOne: { filter: { _id: order._id }, update: { $set: fields } } };
  }),
  carts: docs.carts.map((cart) => ({
    updateOne: {
      filter: { _id: cart._id },
      update: {
        $set: {
          items: (cart.items || []).map((item) => ({
            ...item,
            selectedOptions: (item.selectedOptions || []).map((option) => ({
              ...option,
              ...(monetary(option.priceDelta) && { priceDelta: roundVnd(option.priceDelta) }),
            })),
          })),
        },
      },
    },
  })),
  users: docs.users.filter((doc) => monetary(doc.balance)).map((doc) => ({
    updateOne: { filter: { _id: doc._id }, update: { $set: { balance: roundVnd(doc.balance) } } },
  })),
  restaurants: docs.restaurants.filter((doc) => monetary(doc.balance)).map((doc) => ({
    updateOne: { filter: { _id: doc._id }, update: { $set: { balance: roundVnd(doc.balance) } } },
  })),
  droneHistories: docs.droneHistories.filter((doc) => monetary(doc.totalPrice)).map((doc) => ({
    updateOne: { filter: { _id: doc._id }, update: { $set: { totalPrice: roundVnd(doc.totalPrice) } } },
  })),
});

const report = (docs) => ({
  exchangeRate: USD_TO_VND,
  foods: docs.foods.length,
  legacyOrders: docs.orders.length,
  carts: docs.carts.length,
  userBalances: docs.users.filter((doc) => monetary(doc.balance)).length,
  restaurantBalances: docs.restaurants.filter((doc) => monetary(doc.balance)).length,
  droneDeliveryHistories: docs.droneHistories.filter((doc) => monetary(doc.totalPrice)).length,
});

const main = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);

  const markerCollection = mongoose.connection.collection("system_migrations");
  const alreadyApplied = await markerCollection.findOne({ _id: MIGRATION_ID });
  if (alreadyApplied) {
    throw new Error(`Migration ${MIGRATION_ID} was already applied at ${alreadyApplied.completedAt}`);
  }

  // Use raw collections: legacy orders do not yet have currency, while the
  // current Mongoose schema would supply a default during document hydration.
  const [foods, orders, carts, users, restaurants, droneHistories] = await Promise.all([
    Food.collection.find({}).toArray(),
    Order.collection.find({ currency: { $ne: "VND" } }).toArray(),
    Cart.collection.find({}).toArray(),
    User.collection.find({}).toArray(),
    Restaurant.collection.find({}).toArray(),
    DroneDeliveryHistory.collection.find({}).toArray(),
  ]);
  const docs = { foods, orders, carts, users, restaurants, droneHistories };
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...report(docs) }, null, 2));
  if (!apply) return;

  const operations = updates(docs);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await mongoose.connection.collection("currency_migration_backups").insertOne({
        _id: MIGRATION_ID,
        exchangeRate: USD_TO_VND,
        createdAt: new Date(),
        values: backup(docs),
      }, { session });

      await Promise.all([
        operations.foods.length && Food.collection.bulkWrite(operations.foods, { session }),
        operations.orders.length && Order.collection.bulkWrite(operations.orders, { session }),
        operations.carts.length && Cart.collection.bulkWrite(operations.carts, { session }),
        operations.users.length && User.collection.bulkWrite(operations.users, { session }),
        operations.restaurants.length && Restaurant.collection.bulkWrite(operations.restaurants, { session }),
        operations.droneHistories.length && DroneDeliveryHistory.collection.bulkWrite(operations.droneHistories, { session }),
      ].filter(Boolean));

      await markerCollection.insertOne({
        _id: MIGRATION_ID,
        exchangeRate: USD_TO_VND,
        completedAt: new Date(),
        report: report(docs),
      }, { session });
    });
    console.log("USD to VND migration completed successfully.");
  } finally {
    await session.endSession();
  }
};

main()
  .catch((error) => {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
