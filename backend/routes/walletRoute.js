import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import * as controller from "../controllers/walletController.js";
import { depositPaymentSchema } from "../validations/walletValidation.js";

const router = express.Router();

router.get("/shipper/me", protect, authorize("shipper"), controller.shipperSummary);
router.get("/shipper/transactions", protect, authorize("shipper"), controller.shipperTransactions);
router.get("/shipper/earnings-report", protect, authorize("shipper"), controller.shipperEarningsReport);
router.post("/shipper/deposit/payos", protect, authorize("shipper"), validate(depositPaymentSchema), controller.createDepositPayment);
router.get("/payos/deposit-return", controller.payosDepositReturn);
router.get("/vnpay/deposit-ipn", controller.depositVnpayIpn);
router.get("/vnpay/deposit-return", controller.depositVnpayIpn);

export default router;
