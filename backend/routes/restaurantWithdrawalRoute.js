import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import * as controller from "../controllers/restaurantWithdrawalController.js";
import { createWithdrawalSchema, paidWithdrawalSchema, rejectWithdrawalSchema } from "../validations/restaurantWithdrawalValidation.js";

const router = express.Router();

router.post("/", protect, authorize("restaurant_owner"), validate(createWithdrawalSchema), controller.create);
router.get("/", protect, authorize("restaurant_owner"), controller.list);
router.post("/:id/approve", protect, authorize("admin"), controller.approve);
router.post("/:id/paid", protect, authorize("admin"), validate(paidWithdrawalSchema), controller.paid);
router.post("/:id/reject", protect, authorize("admin"), validate(rejectWithdrawalSchema), controller.reject);

export default router;
