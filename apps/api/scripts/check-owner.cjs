const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Read-only diagnostic: inspects the owner user of the restaurant/merchant.
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const ownerId = new mongoose.Types.ObjectId('68ff3e6a8bb000399eba5b4a');
  const u = await db.collection('users').findOne(
    { _id: ownerId },
    { projection: { name: 1, email: 1, role: 1, restaurantId: 1, merchantId: 1 } }
  );
  console.log('=== OWNER USER ===');
  console.log(JSON.stringify(u, null, 2));
  const roles = await db.collection('users').aggregate([
    { $match: { role: { $in: ['restaurant_owner', 'merchant_owner'] } } },
    { $group: { _id: { role: '$role', hasRestaurantId: { $gt: ['$restaurantId', null] } }, n: { $sum: 1 } } },
  ]).toArray();
  console.log('\n=== OWNER ROLES ===');
  console.log(JSON.stringify(roles, null, 2));
  process.exit(0);
})();
