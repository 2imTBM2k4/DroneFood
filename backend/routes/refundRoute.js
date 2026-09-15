import express from "express";
import { authorize, protect } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import * as controller from "../controllers/refundController.js";
import { markRefundPaidSchema, refundIdParamSchema, refundListQuerySchema, rejectRefundSchema, requestRefundSchema } from "../validations/refundValidation.js";

const router = express.Router();
router.post("/request", protect, authorize("user"), validate(requestRefundSchema), controller.requestManualRefund);
router.get("/", protect, authorize("admin"), validate(refundListQuerySchema, "query"), controller.listManualRefunds);
router.post("/:id/mark-paid", protect, authorize("admin"), validate(refundIdParamSchema, "params"), validate(markRefundPaidSchema), controller.markManualRefundPaid);
router.post("/:id/reject", protect, authorize("admin"), validate(refundIdParamSchema, "params"), validate(rejectRefundSchema), controller.rejectManualRefund);
export default router;
