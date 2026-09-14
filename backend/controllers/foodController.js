import * as foodService from "../services/foodService.js";

export const addFood = async (req, res) => {
  try {
    const result = await foodService.addFood(req.user, req.body, req.file);
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
