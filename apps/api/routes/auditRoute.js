import express from "express";
import { listAuditLogs } from "../controllers/auditController.js";
import { protect, authorize } from "../middleware/auth.js";

const auditRouter = express.Router();

// Read-only by design: the trail is append-only, so there is no update or
// delete endpoint for it.
auditRouter.get("/", protect, authorize("admin"), listAuditLogs);

export default auditRouter;
