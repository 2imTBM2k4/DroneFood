import express from "express";
import { authorize, protect } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import * as controller from "../controllers/voucherController.js";
import {
  createVoucherSchema,
  listVoucherQuerySchema,
  updateVoucherSchema,
  voucherEnabledSchema,
  voucherIdParamSchema,
} from "../validations/voucherValidation.js";

const router = express.Router();
router.use(protect, authorize("admin"));
router.get("/", validate(listVoucherQuerySchema, "query"), controller.listVouchers);
router.post("/", validate(createVoucherSchema), controller.createVoucher);
router.put("/:id", validate(voucherIdParamSchema, "params"), validate(updateVoucherSchema), controller.updateVoucher);
router.patch("/:id/enabled", validate(voucherIdParamSchema, "params"), validate(voucherEnabledSchema), controller.setVoucherEnabled);

export default router;
