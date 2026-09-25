import { Food } from "../models/index.cjs";

export const create = async (foodData) => {
  const { name, description, price, image, category, restaurantId } = foodData;
  if (
    !name ||
    !description ||
    price <= 0 ||
    !image ||
    !category ||
    !restaurantId
  ) {
    throw new Error("Missing required fields for Food");
  }
  const food = new Food(foodData);
  return await food.save();
};

// ✅ FIX: Không populate cho user view, chỉ populate cho admin/owner nếu cần
export const findAll = async (filter = {}, { page = 1, limit = 20, sort } = {}) => {
  const sortBy = {
    price_asc: { price: 1, _id: 1 },
    price_desc: { price: -1, _id: 1 },
    name_asc: { name: 1, _id: 1 },
    name_desc: { name: -1, _id: 1 },
  }[sort] || { _id: 1 };

  const total = await Food.countDocuments(filter);
  const query = Food.find(filter)
    .sort(sortBy)
    .skip((page - 1) * limit)
    .limit(limit);

  const foods = await query.lean();
  const data = foods.map(food => ({
    ...food,
    restaurantId: food.restaurantId?.toString() || food.restaurantId
  }));

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const findById = async (id) => {
  const food = await Food.findById(id).lean();
  if (food && food.restaurantId) {
    food.restaurantId = food.restaurantId.toString();
  }
  return food;
};

export const updateById = async (id, updates) => {
  return await Food.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  }).lean();
};

export const deleteById = async (id) => {
  return await Food.findByIdAndDelete(id);
};
