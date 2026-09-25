require("dotenv").config();
const mongoose = require("mongoose");

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");

  // Avoid Mongoose attempting to recreate the old non-sparse index while this
  // one-off migration changes it. No payment documents are modified.
  mongoose.set("autoIndex", false);
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection("walletpayments");
  const indexes = await collection.indexes();
  const vnpayIndex = indexes.find((index) => index.name === "vnpTxnRef_1");

  if (vnpayIndex && !vnpayIndex.sparse) {
    await collection.dropIndex("vnpTxnRef_1");
    console.log("Replaced legacy vnpTxnRef unique index with a sparse index.");
  }
  if (!vnpayIndex || !vnpayIndex.sparse) {
    await collection.createIndex({ vnpTxnRef: 1 }, { unique: true, sparse: true, name: "vnpTxnRef_1" });
  }
  await collection.createIndex({ payosOrderCode: 1 }, { unique: true, sparse: true, name: "payosOrderCode_1" });
  console.log("Wallet payment indexes are ready for PayOS deposits.");
};

run()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
