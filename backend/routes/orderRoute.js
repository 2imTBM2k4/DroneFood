import express from "express";
import {
  placeOrder,
  quoteDelivery,
  verifyOrder,
  vnpayReturn,
  vnpayIpn,
  userOrders,
  listOrders,
  updateStatus,
  getStatusStats,
} from "../controllers/orderController.js";
import { protect, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  placeOrderSchema,
  deliveryQuoteSchema,
  updateStatusSchema,
  verifyOrderSchema,
} from "../validations/orderValidation.js";

const router = express.Router();

router.post("/quote", protect, validate(deliveryQuoteSchema), quoteDelivery);
router.get("/vnpay-return", vnpayReturn);
router.get("/vnpay-ipn", vnpayIpn);
router.post("/place", protect, validate(placeOrderSchema), placeOrder);
router.post("/verify", protect, validate(verifyOrderSchema), verifyOrder);
router.get("/userorders", protect, userOrders);
router.get("/list", protect, listOrders);
router.post("/status", protect, validate(updateStatusSchema), updateStatus);
router.get("/status-stats", protect, authorize("admin"), getStatusStats);

export default router;
