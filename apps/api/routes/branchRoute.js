import express from "express";
import * as branchController from "../controllers/branchController.js";
import { protect, authorize } from "../middleware/auth.js";
import requireBranchAccess from "../middleware/requireBranchAccess.cjs";
import requireMerchantAccess from "../middleware/requireMerchantAccess.cjs";
import validate from "../middleware/validate.js";
import {
  nearbyBranchesQuerySchema,
  listBranchesQuerySchema,
  createBranchSchema,
  updateBranchSchema,
  setBranchOpenStateSchema,
  lockBranchSchema,
  assignBranchManagersSchema,
  setDroneDeliverySchema,
} from "../validations/branchValidation.js";

const branchRouter = express.Router();

branchRouter.get(
  "/nearby",
  validate(nearbyBranchesQuerySchema, "query"),
  branchController.nearby
);

branchRouter.get(
  "/list",
  validate(listBranchesQuerySchema, "query"),
  branchController.listByMerchant
);

branchRouter.get(
  "/:id",
  branchController.getById
);

branchRouter.post(
  "/",
  protect,
  authorize("merchant_owner", "admin"),
  validate(createBranchSchema),
  requireMerchantAccess,
  branchController.create
);

branchRouter.put(
  "/:id",
  protect,
  requireBranchAccess,
  validate(updateBranchSchema),
  branchController.update
);

branchRouter.patch(
  "/:id/open-state",
  protect,
  requireBranchAccess,
  validate(setBranchOpenStateSchema),
  branchController.setOpenState
);

branchRouter.patch(
  "/:id/drone-delivery",
  protect,
  requireBranchAccess,
  validate(setDroneDeliverySchema),
  branchController.setDroneDelivery
);

branchRouter.delete(
  "/:id",
  protect,
  requireMerchantAccess,
  branchController.remove
);

branchRouter.put(
  "/:id/lock",
  protect,
  authorize("admin"),
  validate(lockBranchSchema),
  branchController.lock
);

branchRouter.post(
  "/:id/managers",
  protect,
  authorize("merchant_owner", "admin"),
  requireMerchantAccess,
  validate(assignBranchManagersSchema),
  branchController.assignManagers
);

export default branchRouter;
