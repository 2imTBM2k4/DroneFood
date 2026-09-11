import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import * as controller from "../controllers/restaurantWithdrawalController.js";
import { createWithdrawalSchema } from "../validations/restaurantWithdrawalValidation.js";

const router = express.Router();

router.post("/", protect, authorize("restaurant_owner"), validate(createWithdrawalSchema), controller.create);
router.get("/", protect, authorize("restaurant_owner"), controller.list);
router.post("/:id/complete", protect, authorize("admin"), controller.complete);

export default router;
