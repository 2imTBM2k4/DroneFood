import express from "express";
import {
  getDeliveryAddresses,
  assignDrone,
  scanQR,
  confirmDelivery,
  getAllDrones,
  createDrone,
  updateDrone,
  deleteDrone,
  getDroneById,
  updateCargoWeight,
  getDroneDeliveryHistory,
  getAllDeliveryHistory,
  reassignDrone,
  resetDrone,
  chargeDrone,
  resetAllStuckDrones,
  getFleetStats,
} from "../controllers/droneController.js";
import { protect, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  createDroneSchema,
  updateDroneSchema,
  assignDroneSchema,
  scanQRSchema,
  confirmDeliverySchema,
  cargoWeightSchema,
  historyQuerySchema,
  reassignDroneSchema,
} from "../validations/droneValidation.js";

const router = express.Router();

router.get("/addresses/:orderId", protect, getDeliveryAddresses);
router.post("/assign", protect, authorize("admin", "restaurant_owner"), validate(assignDroneSchema), assignDrone);
router.post(
  "/reassign",
  protect,
  authorize("admin"),
  validate(reassignDroneSchema),
  reassignDrone
);
router.post("/scan-qr", protect, validate(scanQRSchema), scanQR);
router.post("/confirm-delivery", protect, validate(confirmDeliverySchema), confirmDelivery);
router.post("/cargo-weight", protect, authorize("admin"), validate(cargoWeightSchema), updateCargoWeight);

router.get("/history/all", protect, authorize("admin"), validate(historyQuerySchema, "query"), getAllDeliveryHistory);
router.get("/history/:id", protect, authorize("admin"), getDroneDeliveryHistory);

router.get("/stats/overview", protect, authorize("admin"), getFleetStats);
router.post("/reset-all-stuck", protect, authorize("admin"), resetAllStuckDrones);
router.post("/:id/reset", protect, authorize("admin"), resetDrone);
router.post("/:id/charge", protect, authorize("admin"), chargeDrone);

router.get("/", protect, authorize("admin"), getAllDrones);
router.get("/:id", protect, authorize("admin"), getDroneById);
router.post("/create", protect, authorize("admin"), validate(createDroneSchema), createDrone);
router.put("/:id", protect, authorize("admin"), validate(updateDroneSchema), updateDrone);
router.delete("/:id", protect, authorize("admin"), deleteDrone);

export default router;
