import express from "express";
import {
  addFood,
  listFood,
  removeFood,
  updateFood,
  getFoodById,
  setFoodAvailability,
  setBranchFoodAvailability,
} from "../controllers/foodController.js";
import { uploadMiddleware } from "../config/multer.js";
import { protect, optionalAuth, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { cacheMiddleware } from "../middleware/cache.js";
import {
  addFoodSchema,
  updateFoodSchema,
  removeFoodSchema,
  listFoodQuerySchema,
  foodAvailabilitySchema,
  branchFoodAvailabilitySchema,
} from "../validations/foodValidation.js";

const foodRouter = express.Router();

foodRouter.post(
  "/add",
  protect,
  authorize("restaurant_owner", "merchant_owner", "admin"),
  uploadMiddleware.single("image"),
  validate(addFoodSchema),
  addFood
);
foodRouter.get("/list", optionalAuth, cacheMiddleware(30), validate(listFoodQuerySchema, "query"), listFood);
foodRouter.get("/:id", getFoodById);
foodRouter.post(
  "/remove",
  protect,
  authorize("restaurant_owner", "merchant_owner", "admin"),
  validate(removeFoodSchema),
  removeFood
);
foodRouter.post(
  "/update",
  protect,
  authorize("restaurant_owner", "merchant_owner", "admin"),
  uploadMiddleware.single("image"),
  validate(updateFoodSchema),
  updateFood
);
foodRouter.patch(
  "/:id/availability",
  protect,
  authorize("restaurant_owner", "merchant_owner", "admin"),
  validate(foodAvailabilitySchema),
  setFoodAvailability
);

foodRouter.patch(
  "/:id/branch-availability",
  protect,
  authorize("branch_manager", "merchant_owner", "admin"),
  validate(branchFoodAvailabilitySchema),
  setBranchFoodAvailability
);

export default foodRouter;
