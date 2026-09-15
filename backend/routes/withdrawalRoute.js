import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import * as controller from "../controllers/withdrawalController.js";
import { createWithdrawalSchema, paidWithdrawalSchema, rejectWithdrawalSchema } from "../validations/restaurantWithdrawalValidation.js";

const router = express.Router();

router.post("/shipper", protect, authorize("shipper"), validate(createWithdrawalSchema), controller.createShipper);
router.get("/shipper", protect, authorize("shipper"), controller.listShipper);
router.get("/admin", protect, authorize("admin"), controller.listAdmin);
router.get("/:id/payout-details", protect, authorize("admin"), controller.payoutDetails);
router.post("/:id/approve", protect, authorize("admin"), controller.approve);
router.post("/:id/paid", protect, authorize("admin"), validate(paidWithdrawalSchema), controller.paid);
router.post("/:id/reject", protect, authorize("admin"), validate(rejectWithdrawalSchema), controller.reject);

export default router;
