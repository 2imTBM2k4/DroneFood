import * as userService from "../services/userService.js";
import { geocodeAddress, reverseGeocode as reverseGeocodeAddress } from "../utils/geocode.js";

export const loginUser = async (req, res) => {
  try {
    const result = await userService.loginUser(req.body);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const registerUser = async (req, res) => {
  try {
    const result = await userService.registerUser(req.body);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const result = userService.logoutUser();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: "Error during logout" });
  }
};

export const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "No user in request" });
    }
    const result = await userService.getMe(req.user._id);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const reverseGeocode = async (req, res) => {
  const data = await reverseGeocodeAddress(req.query.lat, req.query.lng);
  res.json({ success: true, data });
};

export const geocodeUserAddress = async (req, res) => {
  const data = await geocodeAddress(req.query.address);
  res.json({ success: true, data });
};

export const updateUserAddress = async (req, res) => {
  try {
    const result = await userService.updateUserAddress(req.user._id, req.body);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const result = await userService.updateProfile(
      req.user._id,
      req.user.email,
      req.body
    );
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const result = await userService.changePassword(
      req.user._id,
      req.body.currentPassword,
      req.body.newPassword
    );
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const result = await userService.updateAvatar(req.user._id, req.file);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const lockUser = async (req, res) => {
  try {
    const userId = req.body.id || req.body.userId;
    const locked =
      req.body.locked !== undefined ? req.body.locked : req.body.lock;
    const result = await userService.lockUser(req.user, userId, locked);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const listUsers = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pagination = page && limit ? { page: parseInt(page), limit: parseInt(limit) } : {};
    const result = await userService.listUsers(pagination);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateUserByAdmin = async (req, res) => {
  try {
    const { userId, ...updates } = req.body;
    const result = await userService.updateUserByAdmin(
      req.user,
      userId,
      updates
    );
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const result = await userService.deleteUser(req.body.userId);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const result = await userService.refreshAccessToken(req.body.refreshToken);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const result = await userService.forgotPassword(req.body.email);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const result = await userService.resetPassword(req.body.token, req.body.password);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getStats = async (req, res) => {
  try {
    const { period = "day" } = req.query;
    const result = await userService.getStats(period);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};
