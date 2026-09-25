import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import foodModel from './models/foodModel.cjs';
import Restaurant from './models/restaurantModel.cjs';
import connectDB from './config/db.js';

dotenv.config();
connectDB();  // Kết nối DB
cloudinary.config({ /* từ .env */ });  // Config từ .env

async function migrate() {
  // Migrate foods
  const foods = await foodModel.find({ image: { $regex: '^/images/' } });  // Chỉ migrate local paths
  for (const food of foods) {
    const localPath = path.join(process.cwd(), 'uploads', food.image.replace('/images/', ''));  // e.g., uploads/foods/xxx.jpg
    if (fs.existsSync(localPath)) {
      const result = await cloudinary.uploader.upload(localPath, { folder: 'foods' });
      await foodModel.findByIdAndUpdate(food._id, { image: result.secure_url });
      console.log(`Migrated food ${food.name}: ${result.secure_url}`);
      fs.unlinkSync(localPath);  // Xóa local
    }
  }

  // Migrate restaurants
  const restaurants = await Restaurant.find({ image: { $regex: '^/images/' } });
  for (const rest of restaurants) {
    const localPath = path.join(process.cwd(), 'uploads', rest.image.replace('/images/restaurants/', ''));  // Adjust path
    if (fs.existsSync(localPath)) {
      const result = await cloudinary.uploader.upload(localPath, { folder: 'restaurants' });
      await Restaurant.findByIdAndUpdate(rest._id, { image: result.secure_url });
      console.log(`Migrated restaurant ${rest.name}: ${result.secure_url}`);
      fs.unlinkSync(localPath);
    }
  }

  console.log('Migration complete!');
  mongoose.connection.close();
}

migrate().catch(console.error);