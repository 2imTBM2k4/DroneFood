import express from "express";
import { getDashboard } from "../controllers/adminDashboardController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/dashboard", protect, authorize("admin"), getDashboard);

export default router;
