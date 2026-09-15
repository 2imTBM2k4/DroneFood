import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Restaurant, ShipperDeposit, ShipperEarningsWallet, User, WalletPayment, WalletTransaction } from "../../models/index.cjs";
import { createAdmin, createOrder, createRestaurantOwner, createUser, generateToken } from "../helpers.js";
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

  it("reserves restaurant withdrawals, then debits only after approval and recorded payment", async () => {
    const { owner, restaurant } = await createRestaurantOwner();
    restaurant.balance = 1500000;
    await restaurant.save();
    const token = generateToken(owner._id);
    const admin = await createAdmin();

    const requests = await Promise.all([1, 2, 3].map(() => request(app)
      .post("/api/restaurant-withdrawals")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 500000 })));
    requests.forEach((response) => expect(response.status).toBe(200));
    expect((await Restaurant.findById(restaurant._id)).balance).toBe(1500000);
    expect((await Restaurant.findById(restaurant._id)).reservedWithdrawalAmount).toBe(1500000);

    const fourth = await request(app).post("/api/restaurant-withdrawals")
      .set("Authorization", `Bearer ${token}`).send({ amount: 500000 });
    expect(fourth.status).toBe(409);

    const payBeforeApproval = await request(app)
      .post(`/api/restaurant-withdrawals/${requests[0].body.data._id}/paid`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ bankTransactionReference: "MB-001" });
    expect(payBeforeApproval.status).toBe(409);

    const approved = await request(app)
      .post(`/api/restaurant-withdrawals/${requests[0].body.data._id}/approve`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({});
    expect(approved.status).toBe(200);
    expect(approved.body.data.request.status).toBe("approved");
    expect((await Restaurant.findById(restaurant._id)).balance).toBe(1500000);

    const paid = await request(app)
      .post(`/api/restaurant-withdrawals/${requests[0].body.data._id}/paid`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ bankTransactionReference: "MB-001" });
    expect(paid.status).toBe(200);
    expect(paid.body.data.request.status).toBe("paid");
    expect((await Restaurant.findById(restaurant._id)).balance).toBe(1000000);
    expect((await Restaurant.findById(restaurant._id)).reservedWithdrawalAmount).toBe(1000000);
    expect(await WalletTransaction.countDocuments({ transactionType: "restaurant_withdrawal" })).toBe(1);
  });

  it("credits an earnings top-up and only lets a shipper withdraw available earnings", async () => {
    const shipper = await createUser({ role: "shipper", email: "earnings-wallet-shipper@test.com" });
    const admin = await createAdmin();
    const payment = await WalletPayment.create({
      shipper: shipper._id, amount: 700000, purpose: "earnings_top_up", paymentProvider: "PAYOS", payosOrderCode: 9876543213,
    });
    await walletService.settleDepositPayment(payment._id, "PAYOS-EARNINGS-1", "PAYOS");
    expect((await ShipperEarningsWallet.findOne({ shipper: shipper._id })).balance).toBe(700000);
    expect(await WalletTransaction.countDocuments({ transactionType: "shipper_earnings_top_up" })).toBe(1);

    const token = generateToken(shipper._id);
    const created = await request(app).post("/api/withdrawals/shipper")
      .set("Authorization", `Bearer ${token}`).send({ amount: 500000 });
    expect(created.status).toBe(200);
    expect(created.body.data.status).toBe("pending");
    expect((await ShipperEarningsWallet.findOne({ shipper: shipper._id })).reservedWithdrawalAmount).toBe(500000);

    const second = await request(app).post("/api/withdrawals/shipper")
      .set("Authorization", `Bearer ${token}`).send({ amount: 500000 });
    expect(second.status).toBe(409);

    await request(app).post(`/api/withdrawals/${created.body.data._id}/approve`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`).send({}).expect(200);
    const paid = await request(app).post(`/api/withdrawals/${created.body.data._id}/paid`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ bankTransactionReference: "MB-SHIPPER-1" });
    expect(paid.status).toBe(200);
    expect(paid.body.data.request.status).toBe("paid");
    expect((await ShipperEarningsWallet.findOne({ shipper: shipper._id })).balance).toBe(200000);
    expect(await WalletTransaction.countDocuments({ transactionType: "shipper_withdrawal" })).toBe(1);
  });

  it("uses deposit plus earnings, including earnings debt, as the COD liability capacity", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "cod-capacity-customer@test.com" });
    const shipper = await createUser({ role: "shipper", email: "cod-capacity-shipper@test.com" });
    await ShipperDeposit.create({ shipper: shipper._id, balance: 350000 });
    await ShipperEarningsWallet.create({ shipper: shipper._id, balance: 200000 });

    const eligible = await createOrder(customer._id, restaurant._id, {
      shipperId: shipper._id, deliveryMethod: "shipper",
      financialSnapshot: { codLiabilityAmount: 400000 },
    });
    await walletService.reserveCodLiability(eligible._id, shipper._id);
    expect((await ShipperEarningsWallet.findOne({ shipper: shipper._id })).reservedCodLiability).toBe(400000);

    const overCapacity = await createOrder(customer._id, restaurant._id, {
      shipperId: shipper._id, deliveryMethod: "shipper",
      financialSnapshot: { codLiabilityAmount: 200000 },
    });
    await expect(walletService.reserveCodLiability(overCapacity._id, shipper._id))
      .rejects.toThrow(/deposit plus available earnings/i);
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
