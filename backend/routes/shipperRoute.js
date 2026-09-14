import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import * as controller from "../controllers/shipperController.js";
import { approvalSchema, declineSchema, locationSchema, statusSchema } from "../validations/shipperValidation.js";

const router = express.Router();
router.get("/", protect, authorize("admin"), controller.list);
router.get("/me", protect, authorize("shipper"), controller.me);
router.put("/me/location", protect, authorize("shipper"), validate(locationSchema), controller.location);
router.put("/me/status", protect, authorize("shipper"), validate(statusSchema), controller.status);
router.get("/me/orders/available", protect, authorize("shipper"), controller.available);
router.get("/me/orders/current", protect, authorize("shipper"), controller.current);
router.post("/me/orders/:id/accept", protect, authorize("shipper"), controller.accept);
router.post("/me/orders/:id/pick-up", protect, authorize("shipper"), controller.pickup);
router.post("/me/orders/:id/complete", protect, authorize("shipper"), controller.complete);
router.post("/me/orders/:id/decline", protect, authorize("shipper"), validate(declineSchema), controller.decline);
router.put("/:userId/approval", protect, authorize("admin"), validate(approvalSchema), controller.approve);
export default router;
