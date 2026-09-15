const mongoose = require("mongoose");

// Snapshot of a pick at order time — the menu may change afterwards, so the
// surcharge is frozen here rather than looked up again later.
const orderItemOptionSchema = new mongoose.Schema({
  groupName: { type: String, required: true },
  optionName: { type: String, required: true },
  priceDelta: { type: Number, default: 0 },
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Food",
          required: true,
        },
        name: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        image: String,
        selectedOptions: { type: [orderItemOptionSchema], default: [] },
        note: { type: String, default: "" },
      },
    ],
    shippingAddress: {
      fullName: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      zipCode: {
        // Optional: Vietnam's current 2-tier admin structure has no postal code,
        // and the map picker leaves it blank.
        type: String,
        default: "",
      },
      phone: {
        type: String,
        required: true,
      },
      // Exact drop-off coordinates captured from the map picker / geolocation.
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },
    currency: {
      type: String,
      enum: ["VND"],
      default: "VND",
      required: true,
    },
    // The delivery quote is persisted at checkout so a later route refresh or
    // rate change can never alter the amount that the customer accepted.
    deliveryMethod: {
      type: String,
      enum: ["shipper", "drone"],
      default: "drone",
    },
    deliveryDistanceKm: { type: Number, default: 0, min: 0 },
    deliveryDistanceType: {
      type: String,
      enum: ["road", "air"],
      default: "air",
    },
    deliveryRatePerKm: { type: Number, default: 0, min: 0 },
    // Financial terms are immutable at checkout. Settlement must use these
    // values instead of any current platform configuration.
    financialSnapshot: {
      restaurantSharePercent: { type: Number, default: 80 },
      platformFoodCommissionPercent: { type: Number, default: 20 },
      shipperDeliverySharePercent: { type: Number, default: 85 },
      platformDeliverySharePercent: { type: Number, default: 15 },
      restaurantPayoutAmount: { type: Number, default: 0 },
      shipperOnlineEarningsAmount: { type: Number, default: 0 },
      codLiabilityAmount: { type: Number, default: 0 },
    },
    // Voucher terms are frozen at checkout. The platform funds the discount,
    // so settlement continues to use itemsPrice/shippingPrice before discount.
    voucherSnapshot: {
      voucherId: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", default: null },
      code: { type: String, default: "" },
      kind: { type: String, enum: ["fixed", "percent", ""], default: "" },
      value: { type: Number, default: 0, min: 0 },
      appliesTo: { type: String, enum: ["items_subtotal", "shipping_fee", ""], default: "" },
      minOrderAmount: { type: Number, default: 0, min: 0 },
      maxDiscountAmount: { type: Number, default: null, min: 0 },
    },
    discountAmount: { type: Number, default: 0, min: 0 },
    discountTargetAmount: { type: Number, default: 0, min: 0 },
    // A reservation is exposure, not a wallet balance. It is released once
    // the COD delivery is settled or the order is cancelled before delivery.
    codReservationStatus: {
      type: String,
      enum: ["none", "reserved", "released"],
      default: "none",
    },
    codReservedLiability: { type: Number, default: 0, min: 0 },
    restaurantSettlementTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "WalletTransaction", default: null },
    shipperSettlementTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "WalletTransaction", default: null },
    pickupLocation: {
      type: { type: String, enum: ["Point"], default: undefined },
      coordinates: { type: [Number], default: undefined },
    },
    shipperId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    shipperAssignmentStatus: {
      type: String,
      enum: ["not_applicable", "unassigned", "accepted", "picked_up", "completed", "expired"],
      default: "not_applicable",
    },
    shipperAssignmentDeadlineAt: { type: Date, default: null, index: true },
    shipperAcceptedAt: { type: Date, default: null },
    shipperPickedUpAt: { type: Date, default: null },
    shipperCompletedAt: { type: Date, default: null },
    cancellationCode: { type: String, default: "" },
    paymentMethod: {
      type: String,
      // required: true,
      // Keep VNPAY so historical orders remain readable after the migration.
      enum: ["COD", "VNPAY", "PAYOS"],
    },
    paymentResult: {
      id: String,
      status: String,
      update_time: String,
      email_address: String,
    },
    // Food subtotal before any fees — the figure the restaurant's share is
    // calculated from. Stored so the split can be audited later.
    itemsPrice: {
      type: Number,
      default: 0,
    },
    serviceFee: {
      type: Number,
      default: 0,
    },
    taxPrice: {
      type: Number,
      default: 0,
    },
    shippingPrice: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    isDelivered: {
      type: Boolean,
      default: false,
    },
    deliveredAt: {
      type: Date,
    },
    orderStatus: {
      type: String,
      enum: ["pending_payment", "pending", "refund_pending", "preparing", "delivering", "delivered", "cancelled"],
      default: "pending",
    },
    reason: {
      type: String,
      default: "",
    },
    vnpTxnRef: { type: String, default: null },
    vnpTransactionNo: { type: String, default: null },
    vnpCreateDate: { type: String, default: null },
    // PayOS identifies a payment request by a merchant-generated numeric code.
    // It is stored separately from the Mongo order id so webhook data can be
    // matched safely and idempotently.
    // Omit this property (rather than store null) for COD/VNPay records so
    // the sparse unique index permits any number of non-PayOS orders.
    payosOrderCode: { type: Number, default: undefined, unique: true, sparse: true },
    payosPaymentLinkId: { type: String, default: null },
    refundStatus: { type: String, enum: ["not_required", "requested", "paid", "rejected", "failed"], default: "not_required" },
    refundRequestId: { type: String, default: null },
    refundRequestedAt: { type: Date, default: null },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    qrCode: {
      type: String,
      default: null,
      comment: "Mã QR để khách hàng xác nhận nhận hàng từ drone",
    },
    qrScanned: {
      type: Boolean,
      default: false,
      comment: "Đã quét QR code chưa",
    },
    qrScannedAt: {
      type: Date,
      default: null,
    },
    droneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drone",
      default: null,
      comment: "Drone được gán để giao đơn hàng này",
    },
    droneArrivedAt: {
      type: Date,
      default: null,
      comment: "Thời điểm drone tới địa chỉ khách hàng",
    },
    cargoChecked: {
      type: Boolean,
      default: false,
      comment: "Đã kiểm tra khoang hàng (trọng lượng + camera)",
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ pickupLocation: "2dsphere" });
orderSchema.index({ deliveryMethod: 1, shipperAssignmentStatus: 1, shipperAssignmentDeadlineAt: 1 });

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
