import express from "express";
import {
  addFood,
  listFood,
  removeFood,
  updateFood,
  getFoodById,
  setFoodAvailability,
} from "../controllers/foodController.js";
import { uploadMiddleware } from "../config/multer.js";
import { protect, optionalAuth } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  addFoodSchema,
  updateFoodSchema,
  removeFoodSchema,
  listFoodQuerySchema,
  foodAvailabilitySchema,
} from "../validations/foodValidation.js";

const foodRouter = express.Router();

foodRouter.post("/add", protect, uploadMiddleware.single("image"), validate(addFoodSchema), addFood);
foodRouter.get("/list", optionalAuth, validate(listFoodQuerySchema, "query"), listFood);
foodRouter.get("/:id", getFoodById);
foodRouter.post("/remove", protect, validate(removeFoodSchema), removeFood);
foodRouter.post("/update", protect, uploadMiddleware.single("image"), validate(updateFoodSchema), updateFood);
foodRouter.patch("/:id/availability", protect, validate(foodAvailabilitySchema), setFoodAvailability);

export default foodRouter;
