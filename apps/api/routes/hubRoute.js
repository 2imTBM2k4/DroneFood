import express from "express";
import * as hubController from "../controllers/hubController.js";
import { protect, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  createHubSchema,
  updateHubSchema,
  listHubsQuerySchema,
} from "../validations/hubValidation.js";

const hubRouter = express.Router();

hubRouter.use(protect, authorize("admin"));

hubRouter.post("/", validate(createHubSchema), hubController.create);
hubRouter.get("/", validate(listHubsQuerySchema, "query"), hubController.list);
hubRouter.get("/:id", hubController.getById);
hubRouter.put("/:id", validate(updateHubSchema), hubController.update);
hubRouter.delete("/:id", hubController.remove);

export default hubRouter;
