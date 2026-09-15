import express from "express";
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

const restaurantRouter = express.Router();

restaurantRouter.get("/list", optionalAuth, listRestaurants);

restaurantRouter.get("/me/bank-account", protect, authorize("restaurant_owner"), bankAccount);
restaurantRouter.put("/me/bank-account", protect, authorize("restaurant_owner"), validate(bankAccountSchema), updateBankAccount);

restaurantRouter.put(
  "/:id",
  protect,
  authorize("restaurant_owner", "admin"),
  uploadMiddleware.single("image"),
  validate(updateRestaurantSchema),
  updateRestaurant
);

restaurantRouter.post(
  "/",
  protect,
  uploadMiddleware.single("image"),
  validate(createRestaurantSchema),
  createRestaurant
);

restaurantRouter.delete("/", protect, authorize("admin"), validate(deleteRestaurantSchema), deleteRestaurant);

restaurantRouter.get("/:id", protect, getRestaurantById);

restaurantRouter.patch(
  "/:id/open-state",
  protect,
  authorize("restaurant_owner", "admin"),
  validate(setOpenStateSchema),
  setOpenState
);

restaurantRouter.put("/:id/lock", protect, authorize("admin"), validate(lockRestaurantSchema), lockRestaurant);

export default restaurantRouter;
