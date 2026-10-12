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

// TRANSITION PERIOD: Cart giữ cả branchId và restaurantId để backward compat
// với legacy endpoints trong 1 sprint.
//
// TODO (Sprint sau):
//   1. Xóa field restaurantId khỏi schema.
//   2. Chạy migration $unset restaurantId trên collection carts.
//   3. Xóa partial unique index { userId: 1, restaurantId: 1 }.
//
// Trong giai đoạn transition:
//   - Phase 2 controller PHẢI chặn cart có cả 2 field (Joi + service validation).
//   - Endpoint mới chỉ nhận branchId.
//   - Endpoint legacy chỉ nhận restaurantId.
const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required() { return !this.restaurantId; },
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      default: null,
    },
    // Deprecated compatibility field for the legacy restaurant endpoints.
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },
    items: [cartItemSchema],
  },
  { timestamps: true, optimisticConcurrency: true }
);

cartSchema.index(
  { userId: 1, branchId: 1 },
  {
    unique: true,
    partialFilterExpression: { branchId: { $type: "objectId" } },
  }
);
cartSchema.index(
  { userId: 1, restaurantId: 1 },
  {
    unique: true,
    partialFilterExpression: { restaurantId: { $type: "objectId" } },
  }
);

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
