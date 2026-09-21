import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import AuditLog from "../../models/auditLogModel.cjs";
import { Cart, Food, Notification, Order, PlatformVoucherFundingLedger, Restaurant, ShipperEarningsWallet, Voucher, VoucherRedemption, WalletTransaction } from "../../models/index.cjs";
import * as orderService from "../../services/orderService.js";
import * as shipperService from "../../services/shipperService.js";
import * as walletService from "../../services/walletService.js";
import * as droneService from "../../services/droneService.js";
import * as voucherRepo from "../../repositories/voucherRepository.js";
import { createAdmin, createRestaurantOwner, createUser, generateToken } from "../helpers.js";

const ADDRESS = {
  fullName: "Voucher Customer",
  address: "123 Test St",
  city: "HCM",
  state: "HCM",
  country: "VN",
  zipCode: "70000",
  phone: "0123456789",
  lat: 10.7769,
  lng: 106.7009,
};

const PAYOS_ENV_KEYS = ["PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY"];
let savedPayosEnvironment;

beforeEach(() => {
  savedPayosEnvironment = Object.fromEntries(PAYOS_ENV_KEYS.map((key) => [key, process.env[key]]));
  PAYOS_ENV_KEYS.forEach((key) => delete process.env[key]);
});

afterEach(() => {
  PAYOS_ENV_KEYS.forEach((key) => {
    if (savedPayosEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = savedPayosEnvironment[key];
  });
});

const voucherData = (adminId, code, overrides = {}) => ({
  code,
  kind: "fixed",
  value: 100000,
  appliesTo: "items_subtotal",
  minOrderAmount: 0,
  startsAt: new Date(Date.now() - 60_000),
  endsAt: new Date(Date.now() + 60 * 60 * 1000),
  totalQuota: 1,
  perUserQuota: 1,
  enabled: true,
  createdBy: adminId,
  ...overrides,
});

const addCartLine = async (customerId, restaurantId) => {
  const food = await Food.create({
    name: "Zero payable food",
    description: "Fully covered by a voucher",
    price: 100000,
    image: "zero.jpg",
    category: "test",
    restaurantId,
  });
  await Cart.create({
    userId: customerId,
    items: [{ lineKey: String(food._id), foodId: food._id, quantity: 1 }],
  });
};

describe("zero-payable PayOS voucher checkout", () => {
  it("settles a fully covered PayOS checkout without PayOS, notifies the normal paid path, and releases its quota once on cancellation", async () => {
    const admin = await createAdmin();
    const customer = await createUser({ email: "zero-voucher-customer@test.com" });
    const { restaurant } = await createRestaurantOwner();
    const voucher = await Voucher.create(voucherData(admin._id, "FREE100"));
    await addCartLine(customer._id, restaurant._id);

    // Credentials are removed for this test. A success proves this checkout
    // did not initialize PayOS or request a payment link.
    const placed = await request(app)
      .post("/api/order/place")
      .set("Authorization", `Bearer ${generateToken(customer._id)}`)
      .send({ address: ADDRESS, paymentMethod: "PAYOS", deliveryMethod: "shipper", voucherCode: voucher.code });

    expect(placed.status).toBe(200);
    expect(placed.body).toMatchObject({
      success: true,
      paymentMethod: "PAYOS",
      totalPrice: 0,
      zeroPayableVoucherCheckout: true,
      newlyPaid: true,
    });
    expect(placed.body.checkoutUrl).toBeUndefined();
    expect(placed.body.paymentUrl).toBeUndefined();

    const order = await Order.findById(placed.body.orderId);
    expect(order).toMatchObject({
      paymentMethod: "PAYOS",
      totalPrice: 0,
      isPaid: true,
      orderStatus: "pending",
      paymentResult: { id: "voucher_zero_payable", status: "ZERO_PAYABLE_VOUCHER" },
    });
    expect(order.paidAt).toBeInstanceOf(Date);
    expect(order.payosOrderCode).toBeUndefined();
    expect(order.payosPaymentLinkId).toBeNull();
    expect(await Cart.findOne({ userId: customer._id })).toBeNull();
    expect((await Voucher.findById(voucher._id)).usageCount).toBe(1);
    expect(await AuditLog.countDocuments({ action: "order.zero_payable_voucher_settled", targetId: order._id })).toBe(1);
    expect(await Notification.countDocuments({ eventKey: `order:${order._id}:payment:confirmed` })).toBe(1);

    const cancellationPayload = { orderId: order._id.toString(), status: "cancelled", reason: "Không còn nhu cầu" };
    const cancellations = await Promise.all([
      request(app).post("/api/order/status").set("Authorization", `Bearer ${generateToken(customer._id)}`).send(cancellationPayload),
      request(app).post("/api/order/status").set("Authorization", `Bearer ${generateToken(customer._id)}`).send(cancellationPayload),
    ]);

    expect(cancellations.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await Order.findById(order._id)).orderStatus).toBe("cancelled");
    expect((await Voucher.findById(voucher._id)).usageCount).toBe(0);
    expect(await VoucherRedemption.countDocuments({ order: order._id, status: "released", releaseReason: "order_cancelled" })).toBe(1);
    expect(await AuditLog.countDocuments({ action: "order.status_changed", targetId: order._id })).toBe(1);
  });

  it("allows only one concurrent zero-payable checkout to reserve a one-use voucher", async () => {
    const admin = await createAdmin();
    const customer = await createUser({ email: "zero-voucher-race@test.com" });
    const { restaurant } = await createRestaurantOwner();
    const voucher = await Voucher.create(voucherData(admin._id, "RACEFREE"));
    await addCartLine(customer._id, restaurant._id);

    const payload = { address: ADDRESS, paymentMethod: "PAYOS", deliveryMethod: "shipper", voucherCode: voucher.code };
    const outcomes = await Promise.allSettled([
      orderService.placeOrder(customer, payload, "127.0.0.1"),
      orderService.placeOrder(customer, payload, "127.0.0.1"),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(await Order.countDocuments({ user: customer._id })).toBe(1);
    expect((await Voucher.findById(voucher._id)).usageCount).toBe(1);
    expect(await VoucherRedemption.countDocuments({ voucher: voucher._id, status: "reserved" })).toBe(1);
  });

  it("reserves one redemption per applied voucher on a single zero-payable order", async () => {
    const admin = await createAdmin();
    const customer = await createUser({ email: "zero-voucher-stacking@test.com" });
    const { restaurant } = await createRestaurantOwner();
    const firstVoucher = await Voucher.create(voucherData(admin._id, "STACKITEMS", { value: 100000 }));
    const secondVoucher = await Voucher.create(voucherData(admin._id, "STACKSHIP", {
      value: 100000,
      appliesTo: "shipping_fee",
    }));
    const order = await Order.create({
      user: customer._id,
      restaurantId: restaurant._id,
      orderItems: [{ product: restaurant._id, name: "Stacked voucher food", quantity: 1, price: 100000 }],
      shippingAddress: ADDRESS,
      paymentMethod: "PAYOS",
      isPaid: true,
      paidAt: new Date(),
      paymentResult: { id: "voucher_zero_payable", status: "ZERO_PAYABLE_VOUCHER", update_time: new Date().toISOString() },
      itemsPrice: 100000,
      shippingPrice: 20000,
      totalPrice: 0,
      discountAmount: 120000,
      deliveryMethod: "shipper",
      orderStatus: "pending",
    });
    const session = await Order.startSession();
    try {
      await session.withTransaction(async () => {
        await voucherRepo.reserveForOrder({ voucher: firstVoucher, userId: customer._id, orderId: order._id, discountAmount: 100000 }, session);
        await voucherRepo.reserveForOrder({ voucher: secondVoucher, userId: customer._id, orderId: order._id, discountAmount: 20000 }, session);
      });
    } finally {
      await session.endSession();
    }

    expect(await VoucherRedemption.countDocuments({ order: order._id, status: "reserved" })).toBe(2);
    expect(await VoucherRedemption.countDocuments({ order: order._id, voucher: { $in: [firstVoucher._id, secondVoucher._id] } })).toBe(2);
  });

  it("denies manual PayOS refunds and keeps drone/no-shipper fallback from claiming a provider refund", async () => {
    const admin = await createAdmin();
    const customer = await createUser({ email: "zero-voucher-refund-denied@test.com" });
    const { restaurant } = await createRestaurantOwner();
    const voucher = await Voucher.create(voucherData(admin._id, "NOREFUND"));
    await addCartLine(customer._id, restaurant._id);
    const checkout = await orderService.placeOrder(customer, {
      address: ADDRESS, paymentMethod: "PAYOS", deliveryMethod: "shipper", voucherCode: voucher.code,
    }, "127.0.0.1");

    const refund = await request(app)
      .post("/api/refunds/request")
      .set("Authorization", `Bearer ${generateToken(customer._id)}`)
      .send({
        orderId: checkout.orderId.toString(), reason: "Không còn nhu cầu",
        bank: { bankName: "ACB", accountNumber: "123456789", accountHolder: "NGUYEN VAN A" },
      });
    expect(refund.status).toBe(409);
    expect(refund.body.message).toMatch(/no PayOS payment to refund/i);

    const noShipperOrder = await Order.create({
      user: customer._id, restaurantId: restaurant._id,
      orderItems: [{ product: restaurant._id, name: "Voucher food", quantity: 1, price: 100000 }],
      shippingAddress: ADDRESS, paymentMethod: "PAYOS", isPaid: true, paidAt: new Date(),
      paymentResult: { id: "voucher_zero_payable", status: "ZERO_PAYABLE_VOUCHER", update_time: new Date().toISOString() },
      itemsPrice: 100000, shippingPrice: 0, totalPrice: 0, discountAmount: 100000,
      deliveryMethod: "shipper", orderStatus: "pending", shipperAssignmentStatus: "unassigned",
      shipperAssignmentDeadlineAt: new Date(Date.now() - 1),
    });
    await shipperService.expireUnacceptedOrders();
    const expired = await Order.findById(noShipperOrder._id);
    expect(expired).toMatchObject({
      orderStatus: "pending", shipperAssignmentStatus: "expired", cancellationCode: "NO_SHIPPER_AVAILABLE", refundStatus: "not_required",
    });
    expect(expired.reason).toMatch(/no PayOS payment to refund/i);

    const droneFallbackOrder = await Order.create({
      user: customer._id, restaurantId: restaurant._id,
      orderItems: [{ product: restaurant._id, name: "Voucher drone food", quantity: 1, price: 100000 }],
      shippingAddress: ADDRESS, paymentMethod: "PAYOS", isPaid: true, paidAt: new Date(),
      paymentResult: { id: "voucher_zero_payable", status: "ZERO_PAYABLE_VOUCHER", update_time: new Date().toISOString() },
      itemsPrice: 100000, shippingPrice: 0, totalPrice: 0, discountAmount: 100000,
      deliveryMethod: "drone", orderStatus: "pending", dronePhase: "fallback_pending_customer_consent",
      droneFallbackDeadlineAt: new Date(Date.now() + 60_000),
    });
    const fallback = await droneService.handleCustomerFallbackConsent(customer, {
      orderId: droneFallbackOrder._id, consent: "accept_shipper",
    });
    expect(fallback.data).toMatchObject({ orderStatus: "cancelled", refundStatus: "not_required", canOrderShipperNew: true });
    expect((await Order.findById(droneFallbackOrder._id)).reason).toMatch(/không có khoản PayOS để hoàn/i);
  });

  it("settles gross restaurant and shipper payouts with a one-time platform voucher funding counter-ledger", async () => {
    const customer = await createUser({ email: "zero-voucher-settlement-customer@test.com" });
    const shipper = await createUser({ role: "shipper", email: "zero-voucher-settlement-shipper@test.com" });
    const { restaurant } = await createRestaurantOwner();
    const order = await Order.create({
      user: customer._id, restaurantId: restaurant._id, shipperId: shipper._id,
      orderItems: [{ product: restaurant._id, name: "Gross voucher food", quantity: 1, price: 100000 }],
      shippingAddress: ADDRESS, paymentMethod: "PAYOS", isPaid: true, paidAt: new Date(),
      paymentResult: { id: "voucher_zero_payable", status: "ZERO_PAYABLE_VOUCHER", update_time: new Date().toISOString() },
      itemsPrice: 100000, shippingPrice: 20000, totalPrice: 0, discountAmount: 120000,
      voucherSnapshots: [{ code: "GROSSFREE", kind: "fixed", value: 120000, appliesTo: "items_subtotal", discountAmount: 100000 }],
      deliveryMethod: "shipper", orderStatus: "arrived_at_delivery", shipperAssignmentStatus: "arrived",
      financialSnapshot: {
        restaurantSharePercent: 80, platformFoodCommissionPercent: 20,
        shipperDeliverySharePercent: 85, platformDeliverySharePercent: 15,
        restaurantPayoutAmount: 80000, shipperOnlineEarningsAmount: 17000, codLiabilityAmount: 103000,
      },
    });

    const settled = await walletService.settleDeliveredOrder(order._id);
    expect(settled.alreadySettled).toBe(false);
    expect((await Restaurant.findById(restaurant._id)).balance).toBe(80000);
    expect((await ShipperEarningsWallet.findOne({ shipper: shipper._id })).balance).toBe(17000);

    const funding = await PlatformVoucherFundingLedger.findOne({ order: order._id });
    expect(funding).toMatchObject({
      amount: 120000,
      counterparty: { restaurantPayoutAmount: 80000, shipperPayoutAmount: 17000 },
      metadata: { settlement: "voucher_zero_payable", customerPayable: 0, grossItemsPrice: 100000, grossShippingPrice: 20000 },
    });
    expect(String(funding.counterparty.restaurant)).toBe(String(restaurant._id));
    expect(String(funding.counterparty.shipper)).toBe(String(shipper._id));
    expect(await AuditLog.countDocuments({ action: "order.platform_voucher_funding_settled", targetId: order._id })).toBe(1);
    expect((await Order.findById(order._id)).platformVoucherFundingLedger.toString()).toBe(String(funding._id));
  });

  it("does not let an admin settle a cancelled zero-payable order through the status API", async () => {
    const admin = await createAdmin();
    const customer = await createUser({ email: "zero-voucher-cancelled-settlement@test.com" });
    const { restaurant } = await createRestaurantOwner();
    const order = await Order.create({
      user: customer._id, restaurantId: restaurant._id,
      orderItems: [{ product: restaurant._id, name: "Cancelled voucher food", quantity: 1, price: 100000 }],
      shippingAddress: ADDRESS, paymentMethod: "PAYOS", isPaid: true, paidAt: new Date(),
      paymentResult: { id: "voucher_zero_payable", status: "ZERO_PAYABLE_VOUCHER", update_time: new Date().toISOString() },
      itemsPrice: 100000, shippingPrice: 0, totalPrice: 0, discountAmount: 100000,
      deliveryMethod: "drone", orderStatus: "cancelled", dronePhase: "cancelled",
      financialSnapshot: {
        restaurantSharePercent: 80, platformFoodCommissionPercent: 20,
        shipperDeliverySharePercent: 85, platformDeliverySharePercent: 15,
        restaurantPayoutAmount: 80000, shipperOnlineEarningsAmount: 0, codLiabilityAmount: 100000,
      },
    });

    await expect(orderService.updateStatus(admin, {
      orderId: order._id, status: "delivered", reason: "Không được quyết toán đơn đã hủy",
    })).rejects.toThrow(/cancelled orders cannot be settled/i);

    expect((await Order.findById(order._id)).orderStatus).toBe("cancelled");
    expect((await Restaurant.findById(restaurant._id)).balance).toBe(0);
    expect(await WalletTransaction.countDocuments({ orderId: order._id })).toBe(0);
    expect(await PlatformVoucherFundingLedger.countDocuments({ order: order._id })).toBe(0);
  });
});
