import express from "express";
import { protect } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import * as controller from "../controllers/notificationController.js";
import { notificationIdParamSchema, notificationListQuerySchema } from "../validations/notificationValidation.js";

const router = express.Router();
router.use(protect);
router.get("/", validate(notificationListQuerySchema, "query"), controller.listMine);
router.get("/unread-count", controller.unreadCountMine);
router.post("/read-all", controller.markAllMineRead);
router.post("/:id/read", validate(notificationIdParamSchema, "params"), controller.markMineRead);

export default router;
