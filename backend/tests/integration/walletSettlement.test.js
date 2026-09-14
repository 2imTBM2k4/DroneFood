import { describe, expect, it } from "vitest";
import { Order, Restaurant, ShipperDeposit, ShipperEarningsWallet, WalletTransaction } from "../../models/index.cjs";
import { createRestaurantOwner, createUser } from "../helpers.js";
import * as walletService from "../../services/walletService.js";

const address = { fullName: "Customer", address: "A", city: "HCM", state: "HCM", country: "VN", phone: "0900000000" };

const createAssignedCodOrder = async (shipperId, restaurantId, customerId, liability, overrides = {}) => Order.create({
  user: customerId,
  restaurantId,
  shipperId,
  orderItems: [{ product: restaurantId, name: "Food", quantity: 1, price: liability }],
  shippingAddress: address,
  paymentMethod: "COD",
  itemsPrice: liability,
  shippingPrice: 0,
  totalPrice: liability,
  deliveryMethod: "shipper",
  orderStatus: "delivering",
  shipperAssignmentStatus: "picked_up",
  codReservationStatus: "none",
  financialSnapshot: {
    restaurantSharePercent: 80, platformFoodCommissionPercent: 20,
    shipperDeliverySharePercent: 85, platformDeliverySharePercent: 15,
    restaurantPayoutAmount: Math.round(liability * 0.8),
    shipperOnlineEarningsAmount: 0,
    codLiabilityAmount: liability,
  },
  ...overrides,
});

describe("Wallet settlement guards", () => {
  it("uses deposit-based dynamic warning and lock thresholds", async () => {
    const shipper = await createUser({ role: "shipper", email: "threshold@test.com" });
    await ShipperDeposit.create({ shipper: shipper._id, balance: 400000 });
    await ShipperEarningsWallet.create({ shipper: shipper._id, balance: -200000 });

    let summary = await walletService.getShipperWalletSummary(shipper._id);
    expect(summary.warningThreshold).toBe(-200000);
    expect(summary.isEarlyWarning).toBe(true);
    expect(summary.lockThreshold).toBe(-300000);
    expect(summary.isAcceptanceLocked).toBe(false);

    await ShipperEarningsWallet.updateOne({ shipper: shipper._id }, { $set: { balance: -300000 } });
    summary = await walletService.getShipperWalletSummary(shipper._id);
    expect(summary.isAcceptanceLocked).toBe(true);

    await ShipperDeposit.updateOne({ shipper: shipper._id }, { $set: { balance: 500000 } });
    summary = await walletService.getShipperWalletSummary(shipper._id);
    expect(summary.lockThreshold).toBe(-375000);
    expect(summary.isAcceptanceLocked).toBe(false);
  });

  it("rejects a COD reservation that would reach the dynamic debt cap", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "reservation-customer@test.com" });
    const shipper = await createUser({ role: "shipper", email: "reservation-shipper@test.com" });
    await ShipperDeposit.create({ shipper: shipper._id, balance: 400000 });
    await ShipperEarningsWallet.create({ shipper: shipper._id, balance: -199000 });
    const order = await createAssignedCodOrder(shipper._id, restaurant._id, customer._id, 101000, { orderStatus: "preparing", shipperAssignmentStatus: "accepted" });

    await expect(walletService.reserveCodLiability(order._id, shipper._id)).rejects.toThrow(/insufficient/i);
    expect((await Order.findById(order._id)).codReservationStatus).toBe("none");
  });

  it("atomically allows only one competing COD reservation at the remaining cap", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "reserve-race-customer@test.com" });
    const shipper = await createUser({ role: "shipper", email: "reserve-race-shipper@test.com" });
    await ShipperDeposit.create({ shipper: shipper._id, balance: 400000 });
    await ShipperEarningsWallet.create({ shipper: shipper._id, balance: -100000 });
    const first = await createAssignedCodOrder(shipper._id, restaurant._id, customer._id, 150000, { orderStatus: "preparing", shipperAssignmentStatus: "accepted" });
    const second = await createAssignedCodOrder(shipper._id, restaurant._id, customer._id, 150000, { orderStatus: "preparing", shipperAssignmentStatus: "accepted" });

    const attempts = await Promise.allSettled([
      walletService.reserveCodLiability(first._id, shipper._id),
      walletService.reserveCodLiability(second._id, shipper._id),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    expect((await ShipperEarningsWallet.findOne({ shipper: shipper._id })).reservedCodLiability).toBe(150000);
  });

  it("settles concurrent reserved COD orders once each without duplicate ledger entries", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "settle-race-customer@test.com" });
    const shipper = await createUser({ role: "shipper", email: "settle-race-shipper@test.com" });
    await ShipperDeposit.create({ shipper: shipper._id, balance: 500000 });
    await ShipperEarningsWallet.create({ shipper: shipper._id, balance: 0, reservedCodLiability: 200000 });
    const first = await createAssignedCodOrder(shipper._id, restaurant._id, customer._id, 100000, { codReservationStatus: "reserved", codReservedLiability: 100000 });
    const second = await createAssignedCodOrder(shipper._id, restaurant._id, customer._id, 100000, { codReservationStatus: "reserved", codReservedLiability: 100000 });

    await Promise.all([walletService.settleDeliveredOrder(first._id), walletService.settleDeliveredOrder(second._id)]);

    const [earnings, updatedRestaurant, transactions] = await Promise.all([
      ShipperEarningsWallet.findOne({ shipper: shipper._id }),
      Restaurant.findById(restaurant._id),
      WalletTransaction.find({ orderId: { $in: [first._id, second._id] } }),
    ]);
    expect(earnings.balance).toBe(-200000);
    expect(earnings.reservedCodLiability).toBe(0);
    expect(updatedRestaurant.balance).toBe(160000);
    expect(transactions).toHaveLength(4);
    expect(new Set(transactions.map((entry) => entry.eventKey)).size).toBe(4);
  });
});
