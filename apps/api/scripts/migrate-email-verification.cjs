const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully.");

    const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));

    // Update all users who don't have isEmailVerified set, or admins/owners created before
    const result = await User.updateMany(
      {
        $or: [
          { isEmailVerified: { $exists: false } },
          { isEmailVerified: null },
        ],
      },
      { $set: { isEmailVerified: true } }
    );

    console.log(`Updated ${result.modifiedCount} existing users to isEmailVerified: true.`);

    const users = await User.find({}, "email role isEmailVerified");
    console.log("Current user verification status:");
    for (const u of users) {
      console.log(`- ${u.get("email")} (${u.get("role")}): isEmailVerified = ${u.get("isEmailVerified")}`);
    }
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
