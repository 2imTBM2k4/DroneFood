// // backend/seeds/seedData.cjs
// const mongoose = require('mongoose');
// const dotenv = require('dotenv');
// const path = require('path');
// const bcrypt = require('bcryptjs');

// // Load .env từ thư mục backend
// dotenv.config({ path: path.join(__dirname, '../.env') });

// // Import models
// const { User, Product, Category, Food, Restaurant } = require('../models/index.cjs');  // Thêm Restaurant

// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log('✅ Database connected successfully');
//   } catch (error) {
//     console.error('❌ Database connection error:', error.message);
//     process.exit(1);
//   }
// };

// // Sample Categories (giữ nguyên)
// const sampleCategories = [
//   { name: 'Men', description: 'Men\'s fashion collection', isActive: true },
//   { name: 'Women', description: 'Women\'s fashion collection', isActive: true },
//   { name: 'Kids', description: 'Kids fashion collection', isActive: true },
//   { name: 'Accessories', description: 'Fashion accessories', isActive: true },
//   { name: 'Shoes', description: 'Footwear collection', isActive: true }
// ];

// // Sample Products (giữ nguyên, nhưng vì project food, có thể ignore nếu không dùng)
// const sampleProducts = [
//   // ... (giữ nguyên code sampleProducts từ file gốc của bạn)
// ];

// // Sample Restaurants (Mới: Thêm 3 sample restaurants)
// const sampleRestaurants = [
//   {
//     name: 'Drone Delivery Burger Joint',
//     address: '123 Food Street, Ho Chi Minh City, Vietnam',
//     phone: '0901234567',
//     description: 'Delicious burgers and fast food classics.',
//     image: 'restaurant_burger.jpg'  // Giả sử upload sau, hoặc null
//   },
//   {
//     name: 'Pho Haven',
//     address: '456 Pho Alley, Hanoi, Vietnam',
//     phone: '0907654321',
//     description: 'Authentic Vietnamese pho and noodle soups.',
//     image: 'restaurant_pho.jpg'
//   },
//   {
//     name: 'Pizza Palace',
//     address: '789 Pizza Plaza, Da Nang, Vietnam',
//     phone: '0909876543',
//     description: 'Italian pizzas with fresh ingredients.',
//     image: 'restaurant_pizza.jpg'
//   }
// ];

// // Sample Foods (Mới: Thêm sample foods với restaurantId, category phù hợp food)
// const sampleFoods = [
//   {
//     name: 'Classic Cheeseburger',
//     description: 'Juicy beef patty with melted cheese and fresh veggies.',
//     price: 150000,
//     category: 'Burgers',
//     image: 'burger_1.jpg',  // Giả sử files ở uploads
//     restaurantId: null  // Sẽ attach sau
//   },
//   {
//     name: 'Beef Pho',
//     description: 'Traditional beef noodle soup with herbs and spices.',
//     price: 120000,
//     category: 'Noodles',
//     image: 'pho_1.jpg',
//     restaurantId: null
//   },
//   {
//     name: 'Margherita Pizza',
//     description: 'Fresh tomato, mozzarella, and basil on thin crust.',
//     price: 200000,
//     category: 'Pizzas',
//     image: 'pizza_1.jpg',
//     restaurantId: null
//   },
//   // Thêm nhiều hơn nếu cần, ví dụ 2-3 foods per restaurant
//   {
//     name: 'Veggie Burger',
//     description: 'Plant-based patty with avocado and sprouts.',
//     price: 130000,
//     category: 'Burgers',
//     image: 'burger_2.jpg',
//     restaurantId: null
//   },
//   {
//     name: 'Chicken Pho',
//     description: 'Tender chicken in aromatic broth.',
//     price: 110000,
//     category: 'Noodles',
//     image: 'pho_2.jpg',
//     restaurantId: null
//   },
//   {
//     name: 'Pepperoni Pizza',
//     description: 'Spicy pepperoni and cheese overload.',
//     price: 220000,
//     category: 'Pizzas',
//     image: 'pizza_2.jpg',
//     restaurantId: null
//   }
// ];

// const seedDatabase = async () => {
//   await connectDB();

//   try {
//     console.log('🗑️  Clearing existing data...');
//     await User.deleteMany({});
//     await Product.deleteMany({});
//     await Category.deleteMany({});
//     if (Food) await Food.deleteMany({});
//     if (Restaurant) await Restaurant.deleteMany({});  // Thêm clear Restaurant
//     console.log('✅ Database cleared\n');

//     // Create Admin User (giữ nguyên)
//     console.log('👤 Creating users...');
//     const hashedAdminPassword = await bcrypt.hash('admin123', 10);
//     const adminUser = await User.create({
//       name: 'Admin Drone Delivery',
//       email: 'admin@dronedelivery.com',
//       password: hashedAdminPassword,
//       role: 'admin',  // Thêm role
//       phone: '0901234567'
//     });
//     console.log('✅ Admin user created');

//     // Create Sample User (giữ nguyên, thêm role)
//     const hashedUserPassword = await bcrypt.hash('user123', 10);
//     const sampleUser = await User.create({
//       name: 'John Doe',
//       email: 'john@example.com',
//       password: hashedUserPassword,
//       role: 'user',
//       phone: '0907654321',
//       address: {
//         street: '123 Main St',
//         city: 'Ho Chi Minh',
//         state: 'HCMC',
//         country: 'Vietnam',
//         zipCode: '700000'
//       }
//     });
//     console.log('✅ Sample user created\n');

//     // Create Restaurants (Mới)
//     console.log('🏪 Creating restaurants...');
//     const createdRestaurants = await Restaurant.insertMany(sampleRestaurants);
//     console.log(`✅ ${createdRestaurants.length} restaurants created\n`);

//     // Attach restaurantId to foods (Mới: Phân bổ foods cho restaurants)
//     console.log('🍔 Attaching restaurants to foods...');
//     const restaurantIds = createdRestaurants.map(r => r._id);
//     sampleFoods.forEach((food, index) => {
//       food.restaurantId = restaurantIds[index % restaurantIds.length];  // Rotate qua restaurants
//     });
//     const createdFoods = await Food.insertMany(sampleFoods);
//     console.log(`✅ ${createdFoods.length} food items created with restaurant IDs\n`);

//     // Create Categories (giữ nguyên)
//     console.log('📁 Creating categories...');
//     const createdCategories = await Category.insertMany(sampleCategories);
//     console.log(`✅ ${createdCategories.length} categories created\n`);

//     // Create Products (giữ nguyên, nếu dùng)
//     console.log('🛍️  Creating products...');
//     const createdProducts = await Product.insertMany(sampleProducts);
//     console.log(`✅ ${createdProducts.length} products created\n`);

//     // Summary (sửa: Thêm Restaurant và Food count)
//     console.log('═══════════════════════════════════════');
//     console.log('🎉 DATABASE SEEDED SUCCESSFULLY! 🎉');
//     console.log('═══════════════════════════════════════\n');

//     console.log('📊 Summary:');
//     console.log(`   Users: ${await User.countDocuments()}`);
//     console.log(`   Restaurants: ${await Restaurant.countDocuments()}`);
//     console.log(`   Categories: ${await Category.countDocuments()}`);
//     console.log(`   Products: ${await Product.countDocuments()}`);
//     console.log(`   Foods: ${await Food.countDocuments()}`);

//     console.log('\n🔐 Login Credentials:');
//     console.log('   ┌─────────────────────────────────────┐');
//     console.log('   │ ADMIN                               │');
//     console.log('   │ Email: admin@dronedelivery.com       │');
//     console.log('   │ Password: admin123                  │');
//     console.log('   ├─────────────────────────────────────┤');
//     console.log('   │ USER                                │');
//     console.log('   │ Email: john@example.com             │');
//     console.log('   │ Password: user123                   │');
//     console.log('   └─────────────────────────────────────┘\n');

//     process.exit(0);
//   } catch (error) {
//     console.error('\n❌ ERROR SEEDING DATABASE:');
//     console.error(error);
//     process.exit(1);
//   }
// };

// // Run seed
// seedDatabase();

// backend/seeds/seedData.cjs
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const bcrypt = require("bcryptjs");

// Load .env từ thư mục backend
dotenv.config({ path: path.join(__dirname, "../.env") });

// Import models (chỉ import những cái cần)
const { User, Food, Restaurant } = require("../models/index.cjs"); // Xóa Category, Product

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection error:", error.message);
    process.exit(1);
  }
};

// Sample Restaurants (giữ nguyên)
const sampleRestaurants = [
  {
    name: "Drone Food Burger Joint",
    address: "123 Food Street, Ho Chi Minh City, Vietnam",
    phone: "0901234567",
    description: "Delicious burgers and fast food classics.",
    image: "restaurant_burger.jpg", // Giả sử upload sau, hoặc null
  },
  {
    name: "Pho Haven",
    address: "456 Pho Alley, Hanoi, Vietnam",
    phone: "0907654321",
    description: "Authentic Vietnamese pho and noodle soups.",
    image: "restaurant_pho.jpg",
  },
  {
    name: "Pizza Palace",
    address: "789 Pizza Plaza, Da Nang, Vietnam",
    phone: "0909876543",
    description: "Italian pizzas with fresh ingredients.",
    image: "restaurant_pizza.jpg",
  },
];

// Sample Foods (giữ nguyên)
const sampleFoods = [
  {
    name: "Classic Cheeseburger",
    description: "Juicy beef patty with melted cheese and fresh veggies.",
    price: 150000,
    category: "Burgers",
    image: "burger_1.jpg", // Giả sử files ở uploads
    restaurantId: null, // Sẽ attach sau
  },
  {
    name: "Beef Pho",
    description: "Traditional beef noodle soup with herbs and spices.",
    price: 120000,
    category: "Noodles",
    image: "pho_1.jpg",
    restaurantId: null,
  },
  {
    name: "Margherita Pizza",
    description: "Fresh tomato, mozzarella, and basil on thin crust.",
    price: 200000,
    category: "Pizzas",
    image: "pizza_1.jpg",
    restaurantId: null,
  },
  // Thêm nhiều hơn nếu cần, ví dụ 2-3 foods per restaurant
  {
    name: "Veggie Burger",
    description: "Plant-based patty with avocado and sprouts.",
    price: 130000,
    category: "Burgers",
    image: "burger_2.jpg",
    restaurantId: null,
  },
  {
    name: "Chicken Pho",
    description: "Tender chicken in aromatic broth.",
    price: 110000,
    category: "Noodles",
    image: "pho_2.jpg",
    restaurantId: null,
  },
  {
    name: "Pepperoni Pizza",
    description: "Spicy pepperoni and cheese overload.",
    price: 220000,
    category: "Pizzas",
    image: "pizza_2.jpg",
    restaurantId: null,
  },
];

const seedDatabase = async () => {
  await connectDB();

  try {
    console.log("🗑️  Clearing existing data...");
    await User.deleteMany({});
    // Xóa clear Category và Product
    // await Category.deleteMany({});
    // await Product.deleteMany({});
    if (Food) await Food.deleteMany({});
    if (Restaurant) await Restaurant.deleteMany({});
    console.log("✅ Database cleared\n");

    // Create Admin User (giữ nguyên)
    console.log("👤 Creating users...");
    const hashedAdminPassword = await bcrypt.hash("admin123", 10);
    const adminUser = await User.create({
      name: "Admin Drone Food",
      email: "admin@dronedelivery.com",
      password: hashedAdminPassword,
      role: "admin", // Thêm role
      phone: "0901234567",
    });
    console.log("✅ Admin user created");

    // Create Sample User (giữ nguyên)
    const hashedUserPassword = await bcrypt.hash("user123", 10);
    const sampleUser = await User.create({
      name: "John Doe",
      email: "john@example.com",
      password: hashedUserPassword,
      role: "user",
      phone: "0907654321",
      address: {
        street: "123 Main St",
        city: "Ho Chi Minh",
        state: "HCMC",
        country: "Vietnam",
        zipCode: "700000",
      },
    });
    console.log("✅ Sample user created\n");

    // Create Restaurants (giữ nguyên)
    console.log("🏪 Creating restaurants...");
    const createdRestaurants = await Restaurant.insertMany(sampleRestaurants);
    console.log(`✅ ${createdRestaurants.length} restaurants created\n`);

    // Attach restaurantId to foods (giữ nguyên)
    console.log("🍔 Attaching restaurants to foods...");
    const restaurantIds = createdRestaurants.map((r) => r._id);
    sampleFoods.forEach((food, index) => {
      food.restaurantId = restaurantIds[index % restaurantIds.length]; // Rotate qua restaurants
    });
    const createdFoods = await Food.insertMany(sampleFoods);
    console.log(
      `✅ ${createdFoods.length} food items created with restaurant IDs\n`
    );

    // Xóa phần create Categories và Products
    // console.log('📁 Creating categories...');
    // const createdCategories = await Category.insertMany(sampleCategories);
    // console.log(`✅ ${createdCategories.length} categories created\n`);

    // console.log('🛍️  Creating products...');
    // const createdProducts = await Product.insertMany(sampleProducts);
    // console.log(`✅ ${createdProducts.length} products created\n`);

    // Summary (sửa: Xóa Category và Product)
    console.log("═══════════════════════════════════════");
    console.log("🎉 DATABASE SEEDED SUCCESSFULLY! 🎉");
    console.log("═══════════════════════════════════════\n");

    console.log("📊 Summary:");
    console.log(`   Users: ${await User.countDocuments()}`);
    console.log(`   Restaurants: ${await Restaurant.countDocuments()}`);
    console.log(`   Foods: ${await Food.countDocuments()}`);

    console.log("\n🔐 Login Credentials:");
    console.log("   ┌─────────────────────────────────────┐");
    console.log("   │ ADMIN                               │");
    console.log("   │ Email: admin@dronedelivery.com       │");
    console.log("   │ Password: admin123                  │");
    console.log("   ├─────────────────────────────────────┤");
    console.log("   │ USER                                │");
    console.log("   │ Email: john@example.com             │");
    console.log("   │ Password: user123                   │");
    console.log("   └─────────────────────────────────────┘\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERROR SEEDING DATABASE:");
    console.error(error);
    process.exit(1);
  }
};

// Run seed
seedDatabase();
