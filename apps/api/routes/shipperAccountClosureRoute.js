import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import * as controller from "../controllers/shipperAccountClosureController.js";
import { createClosureSchema, updateClosureBankSchema } from "../validations/shipperAccountClosureValidation.js";

const router = express.Router();

router.post("/", protect, authorize("shipper"), validate(createClosureSchema), controller.request);
router.put("/bank-details", validate(updateClosureBankSchema), controller.updateBankDetails);
router.post("/:id/request-bank-details", protect, authorize("admin"), controller.sendBankDetailsForm);
router.post("/:id/approve", protect, authorize("admin"), controller.approve);

export default router;
