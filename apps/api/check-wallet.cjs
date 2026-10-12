const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const restaurantId = '68ff3e6a8bb000399eba5b4c';
  
  console.log('=== RESTAURANT ===');
  const r = await db.collection('restaurants').findOne(
    { _id: new mongoose.Types.ObjectId(restaurantId) },
    { projection: { name: 1, balance: 1, owner: 1, isLocked: 1 } }
  );
  console.log(JSON.stringify(r, null, 2));

  console.log('\n=== MERCHANT ===');
  const m = await db.collection('merchants').findOne(
    { _id: new mongoose.Types.ObjectId(restaurantId) },
    { projection: { name: 1, balance: 1, ownerUserId: 1, status: 1, legacyRestaurantId: 1 } }
  );
  console.log(JSON.stringify(m, null, 2));

  console.log('\n=== WALLET TRANSACTIONS (ownerId) ===');
  const wt = await db.collection('wallettransactions').find(
    { ownerId: new mongoose.Types.ObjectId(restaurantId) }
  ).sort({ createdAt: -1 }).limit(1).toArray();
  console.log(JSON.stringify(wt, null, 2));

  process.exit(0);
})();
