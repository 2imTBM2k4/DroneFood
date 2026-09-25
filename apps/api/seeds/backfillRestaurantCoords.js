// One-off backfill: geocode the `address` of every restaurant that has no
// coordinates yet and store lat/lng. Safe to re-run — it only touches
// restaurants still missing coordinates.
//
// Usage (from backend/):  node seeds/backfillRestaurantCoords.js
import "dotenv/config";
import mongoose from "mongoose";
import Restaurant from "../models/restaurantModel.cjs";
import { geocodeAddress } from "../utils/geocode.js";

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in environment.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected. Backfilling restaurant coordinates…\n");

  const restaurants = await Restaurant.find({
    $or: [{ lat: null }, { lat: { $exists: false } }],
  });
  console.log(`${restaurants.length} restaurant(s) without coordinates.\n`);

  let ok = 0;
  let failed = 0;
  for (const r of restaurants) {
    const coords = await geocodeAddress(r.address);
    if (coords) {
      r.lat = coords.lat;
      r.lng = coords.lng;
      await r.save();
      ok += 1;
      console.log(`✓ ${r.name} → ${coords.lat}, ${coords.lng}  (${r.address})`);
    } else {
      failed += 1;
      console.log(`✗ ${r.name} — could not geocode "${r.address}"`);
    }
    // Be gentle with the public geocoding key's rate limit.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  console.log(`\nDone. ${ok} updated, ${failed} failed.`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
