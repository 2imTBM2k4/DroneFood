import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getCart,
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
} from "../validations/cartValidation.js";

const router = express.Router();

router.use(protect);

router.get("/get", getCart);
router.post("/add", validate(addToCartSchema), addToCart);
// Lines, not dishes: quantity is set outright and 0 drops the line. This
// replaces the old /remove endpoint, which decremented by one per request.
router.post("/update-line", validate(updateLineSchema), updateCartLine);
router.post("/remove-line", validate(lineKeySchema), removeCartLine);
router.post("/clear", clearCart);

export default router;
