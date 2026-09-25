// backend/models/cartModel.cjs
const mongoose = require("mongoose");

// A resolved pick, stored with the surcharge that applied when it was added.
const selectedOptionSchema = new mongoose.Schema({
  groupName: { type: String, required: true },
  optionName: { type: String, required: true },
  priceDelta: { type: Number, default: 0 },
}, { _id: false });

const cartItemSchema = new mongoose.Schema({
  // The same dish with different options makes different lines, so the line —
  // not the dish — is the unit of the cart. lineKey is derived server-side
  // from foodId plus the sorted picks (see utils/foodOptions.js).
  lineKey: { type: String, required: true },
  foodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Food",
    required: true,
  },
  quantity: { type: Number, default: 1, min: 1 },
  selectedOptions: { type: [selectedOptionSchema], default: [] },
  note: { type: String, default: "", maxlength: 200 },
});

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
