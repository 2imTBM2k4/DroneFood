import express from "express";
import fs from "fs";
import {
  listRestaurants,
  updateRestaurant,
  createRestaurant,
  deleteRestaurant,
  getRestaurantById,
  lockRestaurant,
  setOpenState,
  bankAccount,
  updateBankAccount,
} from "../controllers/restaurantController.js";
import { protect, optionalAuth, authorize } from "../middleware/auth.js";
import { uploadMiddleware } from "../config/multer.js";
import validate from "../middleware/validate.js";
import {
  createRestaurantSchema,
  updateRestaurantSchema,
  deleteRestaurantSchema,
  lockRestaurantSchema,
  setOpenStateSchema,
} from "../validations/restaurantValidation.js";
import { bankAccountSchema } from "../validations/bankAccountValidation.js";
import { cacheMiddleware } from "../middleware/cache.js";

const restaurantRouter = express.Router();

restaurantRouter.use((req, res, next) => {
  console.warn(`[LEGACY API] ${req.method} ${req.originalUrl || req.url} user: ${req.user?._id || "unauthenticated"}`);
  next();
});

const deprecatedWrite = (req, res) => {
  res.status(410).json({
    success: false,
    message: "API này đã được thay thế. Vui lòng dùng /api/merchant hoặc /api/branch.",
  });
};

restaurantRouter.get("/list", optionalAuth, cacheMiddleware(30), listRestaurants);

restaurantRouter.get("/me/bank-account", protect, authorize("restaurant_owner", "merchant_owner"), bankAccount);
restaurantRouter.put("/me/bank-account", protect, authorize("restaurant_owner", "merchant_owner"), validate(bankAccountSchema), updateBankAccount);

restaurantRouter.put("/:id/lock", protect, authorize("admin"), validate(lockRestaurantSchema), lockRestaurant);

restaurantRouter.put(
  "/:id",
  protect,
  authorize("restaurant_owner", "merchant_owner", "admin"),
  uploadMiddleware.single("image"),
  validate(updateRestaurantSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { Merchant, Branch, Restaurant } = await import("../models/index.cjs");
      const merchantService = await import("../services/merchantService.js");
      const branchService = await import("../services/branchService.js");
      const restaurantService = await import("../services/restaurantService.js");

      // 1. Cập nhật Restaurant legacy nếu tồn tại
      let updatedRest = null;
      if (await Restaurant.exists({ _id: id })) {
        const restResult = await restaurantService.updateRestaurant(
          req.user,
          id,
          req.body,
          req.file
        );
        updatedRest = restResult.data;
      }

      // 2. Tìm Merchant tương ứng
      const merchant = await Merchant.findOne({
        $or: [{ legacyRestaurantId: id }, { _id: id }],
      });

      if (merchant) {
        // Cập nhật merchant fields
        const merchantUpdates = {};
        if (req.body.name) merchantUpdates.name = req.body.name;
        if (req.body.description !== undefined) merchantUpdates.description = req.body.description;
        if (updatedRest?.image) {
          merchantUpdates.logoUrl = updatedRest.image;
        }

        if (Object.keys(merchantUpdates).length > 0) {
          await merchantService.updateMerchant(merchant._id, merchantUpdates, req.user);
        }

        // Cập nhật Branch MAIN fields
        const branch = await Branch.findOne({ merchantId: merchant._id, code: "MAIN" });
        if (branch) {
          const branchUpdates = {};
          if (req.body.address) {
            let lat = updatedRest?.lat ?? null;
            let lng = updatedRest?.lng ?? null;
            let text = typeof req.body.address === "string" ? req.body.address : req.body.address.text || "";
            if (typeof req.body.address === "object" && req.body.address !== null) {
              lat = req.body.address.lat ?? lat;
              lng = req.body.address.lng ?? lng;
            }
            branchUpdates.address = {
              text,
              lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
              lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
              geocodedAt: lat != null && lng != null ? new Date() : null,
            };
            if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
              branchUpdates.location = {
                type: "Point",
                coordinates: [Number(lng), Number(lat)],
              };
            }
          }
          if (req.body.phone !== undefined) branchUpdates.phone = req.body.phone;
          if (req.body.isOpen !== undefined) branchUpdates.isOpen = req.body.isOpen;
          if (req.body.openingHours) {
            let hours = req.body.openingHours;
            if (typeof hours === "string") {
              try { hours = JSON.parse(hours); } catch {}
            }
            if (hours && hours.openTime && hours.closeTime) {
              branchUpdates.operatingHours = Array.from({ length: 7 }, (_, day) => ({
                day,
                open: hours.openTime,
                close: hours.closeTime,
              }));
            }
          }
          if (Object.keys(branchUpdates).length > 0) {
            await branchService.updateBranch(branch._id, branchUpdates, req.user);
          }
        }
      }

      res.json({
        success: true,
        message: "Restaurant updated successfully",
        data: updatedRest || { _id: id, ...req.body },
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message });
    }
  }
);

restaurantRouter.patch(
  "/:id/open-state",
  protect,
  authorize("restaurant_owner", "merchant_owner", "admin"),
  validate(setOpenStateSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isOpen } = req.body;
      const { Merchant, Branch, Restaurant } = await import("../models/index.cjs");
      const branchService = await import("../services/branchService.js");
      const restaurantRepo = await import("../repositories/restaurantRepository.js");

      const merchant = await Merchant.findOne({
        $or: [{ legacyRestaurantId: id }, { _id: id }],
      });

      let updatedBranch = null;
      if (merchant) {
        const branch = await Branch.findOne({ merchantId: merchant._id, code: "MAIN" });
        if (branch) {
          updatedBranch = await branchService.setBranchOpenState(branch._id, isOpen, req.user);
        }
      }

      let updatedRest = null;
      if (await Restaurant.exists({ _id: id })) {
        updatedRest = await restaurantRepo.updateById(id, { isOpen });
      }

      res.json({
        success: true,
        message: isOpen ? "Restaurant is now open" : "Restaurant is now closed",
        data: updatedBranch || updatedRest || { isOpen },
      });
    } catch (error) {
      res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message });
    }
  }
);

restaurantRouter.post("/", protect, deprecatedWrite);
restaurantRouter.delete("/", protect, deprecatedWrite);

restaurantRouter.get("/:id", protect, getRestaurantById);

export default restaurantRouter;
