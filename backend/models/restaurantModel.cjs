const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    description: { type: String },
    image: { type: String },
    // Geocoded from `address` (TrackAsia) so the storefront can compute
    // distance / ETA and filter restaurants near the customer.
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    balance: { type: Number, default: 0 },
    // The existing restaurant balance remains the wallet source of truth.
    // Pending/approved withdrawals reserve part of it without debiting it.
    reservedWithdrawalAmount: { type: Number, default: 0, min: 0 },
    // The display-safe portion of the payout account. The actual account
    // number is encrypted separately and is never included in normal reads.
    bankAccount: {
      bankName: { type: String, default: "" },
      accountHolder: { type: String, default: "" },
      accountNumberLast4: { type: String, default: "" },
      updatedAt: { type: Date, default: null },
    },
    bankAccountEncrypted: { type: String, default: undefined, select: false },
    // Admin approval gate — a locked restaurant cannot trade at all and its
    // owner cannot even sign in.
    isLocked: { type: Boolean, default: true },
    // The owner's own open/closed switch. Closed hides the restaurant from
    // customers and refuses new orders, but the owner keeps full access.
    isOpen: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Middleware ngăn xóa nhà hàng khi đã có order (bất kể trạng thái)
restaurantSchema.pre(["deleteOne", "findOneAndDelete"], async function (next) {
  const Order = require("./orderModel.cjs");
  const filter = this.getFilter();
  const restaurantId = filter._id;

  if (!restaurantId) return next();

  const totalOrders = await Order.countDocuments({ restaurantId });

  if (totalOrders > 0) {
    const error = new Error(
      `Không thể xóa nhà hàng. Nhà hàng này đã có ${totalOrders} đơn hàng trong hệ thống.`
    );
    error.name = "RestaurantDeleteError";
    return next(error);
  }

  next();
});

// Middleware cho deleteMany
restaurantSchema.pre("deleteMany", async function (next) {
  const Order = require("./orderModel.cjs");
  const filter = this.getFilter();

  const totalOrders = await Order.countDocuments({
    restaurantId: { $in: filter._id?.$in || [filter._id] },
  });

  if (totalOrders > 0) {
    const error = new Error(
      `Không thể xóa nhà hàng. Có ${totalOrders} đơn hàng liên quan.`
    );
    error.name = "RestaurantDeleteError";
    return next(error);
  }

  next();
});

module.exports = mongoose.models.Restaurant || mongoose.model("Restaurant", restaurantSchema);
