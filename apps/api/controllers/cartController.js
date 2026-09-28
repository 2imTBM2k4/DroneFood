import * as cartService from "../services/cartService.js";

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getCarts = handle((req) =>
  cartService.listCarts(req.user._id, req.query.addressEntryId)
);
export const getCart = handle((req) =>
  cartService.getCart(req.user._id, req.params.cartId)
);
export const getLegacyCart = handle((req) =>
  cartService.getLegacyCart(req.user._id)
);
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
  cartService.updateLine(
    req.user._id,
    req.params.cartId,
    req.body.lineKey,
    req.body.quantity
  )
);
export const removeCartLine = handle((req) =>
  cartService.removeLine(
    req.user._id,
    req.params.cartId,
    req.body.lineKey
  )
);
export const clearCart = handle((req) =>
  cartService.clearCart(req.user._id, req.params.cartId)
);
