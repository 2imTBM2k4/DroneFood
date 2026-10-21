import * as foodService from "../services/foodService.js";
import { clearCache } from "../middleware/cache.js";

export const addFood = async (req, res) => {
  try {
    const result = await foodService.addFood(req.user, req.body, req.file);
    clearCache("/api/food");
    res.status(201).json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const listFood = async (req, res) => {
  try {
    const result = await foodService.listFood(req.user, req.query);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const removeFood = async (req, res) => {
  try {
    const result = await foodService.removeFood(req.user, req.body.id);
    clearCache("/api/food");
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateFood = async (req, res) => {
  try {
    const result = await foodService.updateFood(req.user, req.body, req.file);
    clearCache("/api/food");
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getFoodById = async (req, res) => {
  try {
    const result = await foodService.getFoodById(req.params.id);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const setFoodAvailability = async (req, res) => {
  try {
    const result = await foodService.setFoodAvailability(req.user, req.params.id, req.body.isAvailable);
    clearCache("/api/food");
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const setBranchFoodAvailability = async (req, res) => {
  try {
    const result = await foodService.setBranchFoodAvailability(
      req.user,
      req.params.id,
      req.body.branchId,
      req.body.isAvailable
    );
    clearCache("/api/food");
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
