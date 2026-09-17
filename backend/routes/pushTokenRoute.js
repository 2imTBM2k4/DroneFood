import express from "express";
import { protect } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import * as controller from "../controllers/pushTokenController.js";
import { registerPushTokenSchema, unregisterPushTokenSchema } from "../validations/pushTokenValidation.js";

const router = express.Router();
router.use(protect);
router.post("/register", validate(registerPushTokenSchema), controller.register);
router.post("/unregister", validate(unregisterPushTokenSchema), controller.unregister);

export default router;
