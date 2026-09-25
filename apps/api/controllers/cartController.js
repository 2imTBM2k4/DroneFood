import * as cartService from "../services/cartService.js";

const handle = (fn) => async (req, res) => {
  try {
    const result = await fn(req);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getCart = handle((req) => cartService.getCart(req.user._id));

export const addToCart = handle((req) =>
  cartService.addToCart(
    req.user._id,
    req.body.itemId,
    req.body.quantity || 1,
    req.body.selectedOptions || [],
    req.body.note || ""
  )
);

export const updateCartLine = handle((req) =>
  cartService.updateLine(req.user._id, req.body.lineKey, req.body.quantity)
);

export const removeCartLine = handle((req) =>
  cartService.removeLine(req.user._id, req.body.lineKey)
);

export const clearCart = handle((req) => cartService.clearCart(req.user._id));
