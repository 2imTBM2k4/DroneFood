import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Restaurant, ShipperDeposit, ShipperEarningsWallet, User, WalletPayment, WalletTransaction } from "../../models/index.cjs";
import { createAdmin, createRestaurantOwner, createUser, generateToken } from "../helpers.js";
import * as closureService from "../../services/shipperAccountClosureService.js";
import * as walletService from "../../services/walletService.js";

describe("Wallet operations", () => {
  it("requires a 350k initial deposit and creates a ledger entry after payment confirmation", async () => {
    const shipper = await createUser({ role: "shipper", email: "deposit-shipper@test.com" });
    const tooSmall = await WalletPayment.create({ shipper: shipper._id, amount: 349000, vnpTxnRef: "deposit-too-small" });
    await expect(walletService.settleDepositPayment(tooSmall._id)).rejects.toThrow(/at least 350000/i);

    const payment = await WalletPayment.create({ shipper: shipper._id, amount: 350000, vnpTxnRef: "deposit-valid" });
    await walletService.settleDepositPayment(payment._id, "VNP-001");
    expect((await ShipperDeposit.findOne({ shipper: shipper._id })).balance).toBe(350000);
    expect((await WalletPayment.findById(payment._id)).status).toBe("paid");
    expect(await WalletTransaction.countDocuments({ transactionType: "shipper_deposit_top_up" })).toBe(1);
  });

  it("limits restaurant withdrawals and debits only after simulated completion", async () => {
    const { owner, restaurant } = await createRestaurantOwner();
    restaurant.balance = 600000;
    await restaurant.save();
    const token = generateToken(owner._id);
    const admin = await createAdmin();

    const requests = await Promise.all([1, 2, 3].map(() => request(app)
      .post("/api/restaurant-withdrawals")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 500000 })));
    requests.forEach((response) => expect(response.status).toBe(200));
    expect((await Restaurant.findById(restaurant._id)).balance).toBe(600000);

    const fourth = await request(app).post("/api/restaurant-withdrawals")
      .set("Authorization", `Bearer ${token}`).send({ amount: 500000 });
    expect(fourth.status).toBe(409);

    const complete = await request(app)
      .post(`/api/restaurant-withdrawals/${requests[0].body.data._id}/complete`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({});
    expect(complete.status).toBe(200);
    expect(complete.body.data.request.status).toBe("approved");
    expect((await Restaurant.findById(restaurant._id)).balance).toBe(100000);
    expect(await WalletTransaction.countDocuments({ transactionType: "restaurant_withdrawal" })).toBe(1);
  });

  it("locks a closing shipper and offsets negative earnings against deposit before refund", async () => {
    const shipper = await createUser({ role: "shipper", email: "closure-shipper@test.com" });
    const admin = await createAdmin();
    await ShipperDeposit.create({ shipper: shipper._id, balance: 350000 });
    await ShipperEarningsWallet.create({ shipper: shipper._id, balance: -200000 });

    const requested = await closureService.requestClosure(shipper._id, {
      bankName: "Test Bank", accountHolder: "Test Shipper", accountNumber: "123456789",
    });
    expect((await User.findById(shipper._id)).locked).toBe(true);

    const result = await closureService.approveClosure(admin, requested.closure._id);
    expect(result.refundAmount).toBe(150000);
    expect((await ShipperDeposit.findOne({ shipper: shipper._id })).balance).toBe(0);
    expect((await ShipperEarningsWallet.findOne({ shipper: shipper._id })).balance).toBe(0);
    expect(await WalletTransaction.countDocuments({ closureId: requested.closure._id })).toBe(3);
  });

  it("reports only settled online earnings grouped by Vietnam day and month", async () => {
    const shipper = await createUser({ role: "shipper", email: "earnings-report@test.com" });
    await WalletTransaction.create([
      {
        walletType: "shipper_earnings", ownerType: "shipper", ownerId: shipper._id,
        amount: 17000, balanceBefore: 0, balanceAfter: 17000,
        transactionType: "shipper_online_delivery_earnings", eventKey: "report-online-1",
        createdAt: new Date("2026-01-31T17:30:00.000Z"), updatedAt: new Date("2026-01-31T17:30:00.000Z"),
      },
      {
        walletType: "shipper_earnings", ownerType: "shipper", ownerId: shipper._id,
        amount: 25500, balanceBefore: 17000, balanceAfter: 42500,
        transactionType: "shipper_online_delivery_earnings", eventKey: "report-online-2",
        createdAt: new Date("2026-02-01T10:00:00.000Z"), updatedAt: new Date("2026-02-01T10:00:00.000Z"),
      },
      {
        walletType: "shipper_earnings", ownerType: "shipper", ownerId: shipper._id,
        amount: -303000, balanceBefore: 42500, balanceAfter: -260500,
        transactionType: "shipper_cod_collection", eventKey: "report-cod-debit",
        createdAt: new Date("2026-02-01T11:00:00.000Z"), updatedAt: new Date("2026-02-01T11:00:00.000Z"),
      },
    ]);

    const report = await walletService.getShipperEarningsReport(shipper._id);
    expect(report.totalEarned).toBe(42500);
    expect(report.daily).toEqual([{ period: "2026-02-01", amount: 42500, deliveries: 2 }]);
    expect(report.monthly).toEqual([{ period: "2026-02", amount: 42500, deliveries: 2 }]);
  });
});
