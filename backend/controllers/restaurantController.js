import * as restaurantService from "../services/restaurantService.js";
import * as bankAccountService from "../services/bankAccountService.js";
import fs from "fs";

export const listRestaurants = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pagination = page && limit ? { page: parseInt(page), limit: parseInt(limit) } : {};
    const result = await restaurantService.listRestaurants(pagination);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await restaurantService.updateRestaurant(
      req.user,
      id,
      req.body,
      req.file
    );
    res.json(result);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const bankAccount = async (req, res) => {
  try {
    res.json(await bankAccountService.getRestaurantBankAccount(req.user));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const updateBankAccount = async (req, res) => {
  try {
    res.json(await bankAccountService.updateRestaurantBankAccount(req.user, req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const createRestaurant = async (req, res) => {
  try {
    const result = await restaurantService.createRestaurant(
      req.user,
      req.body,
      req.file
    );
    res.status(201).json(result);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.body;
    const result = await restaurantService.deleteRestaurant(req.user, id);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await restaurantService.getRestaurantById(id);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const lockRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { isLocked } = req.body;
    const result = await restaurantService.lockRestaurant(req.user, id, isLocked);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const setOpenState = async (req, res) => {
  try {
    const result = await restaurantService.setOpenState(
      req.user,
      req.params.id,
      req.body.isOpen
    );
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};
