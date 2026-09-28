import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getCarts,
  getCart,
  getLegacyCart,
  addToCart,
  updateCartLine,
  removeCartLine,
  clearCart,
} from "../controllers/cartController.js";
import validate from "../middleware/validate.js";
import {
  addToCartSchema,
  updateLineSchema,
  lineKeySchema,
  cartParamsSchema,
} from "../validations/cartValidation.js";

const router = express.Router();
router.use(protect);

router.get("/", getCarts);
router.get("/get", getLegacyCart);
router.post("/add", validate(addToCartSchema), addToCart);
router.get("/:cartId", validate(cartParamsSchema, "params"), getCart);
router.post(
  "/:cartId/update-line",
  validate(cartParamsSchema, "params"),
  validate(updateLineSchema),
  updateCartLine
);
router.post(
  "/:cartId/remove-line",
  validate(cartParamsSchema, "params"),
  validate(lineKeySchema),
  removeCartLine
);
router.delete("/:cartId", validate(cartParamsSchema, "params"), clearCart);

export default router;
