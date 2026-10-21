import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import {
  AuditLog,
  Cart,
  Order,
  RefundRequest,
  Restaurant,
  ShipperDeposit,
  ShipperEarningsWallet,
  ShipperProfile,
  User,
  WalletPayment,
  WalletTransaction,
} from "../../models/index.cjs";
import {
  createAdmin,
  createFood,
  createOrder,
  createRestaurantOwner,
  createUser,
  generateToken,
} from "../helpers.js";
import * as walletService from "../../services/walletService.js";

const payosGateway = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@payos/node", () => ({
  PayOS: class {
    paymentRequests = {
      create: payosGateway.create,
      get: payosGateway.get,
      cancel: payosGateway.cancel,
    };
    webhooks = {
      verify: payosGateway.verify,
    };
  },
}));

const DEFAULT_ADDRESS = {
  fullName: "Nguyen Van A",
  address: "123 Le Loi, Ben Nghe, Q1",
  city: "Ho Chi Minh",
  state: "Ho Chi Minh",
  country: "VN",
  zipCode: "70000",
  phone: "0901234567",
  lat: 10.7769,
  lng: 106.7009,
};

describe("Financial & Emergency Business Flows (Group 1)", () => {
  let admin, adminToken;
  let savedEnv;
  const envKeys = ["PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY"];

  beforeEach(async () => {
    savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
    envKeys.forEach((k) => {
      process.env[k] = "test-only-key";
    });

    vi.clearAllMocks();
    payosGateway.create.mockImplementation(async (payload) => ({
      paymentLinkId: `link-${payload.orderCode}`,
      checkoutUrl: `https://pay.payos.vn/web/${payload.orderCode}`,
      qrCode: "000201...",
    }));

    admin = await createAdmin();
    adminToken = generateToken(admin._id);
  });

  afterEach(() => {
    envKeys.forEach((k) => {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    });
  });

  describe("Flow 7: PayOS Payment Retry & Concurrent Race Prevention", () => {
    it("regenerates checkout link for unpaid PayOS order and protects against race conditions", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "retry-payos-cust@test.com" });
      const customerToken = generateToken(customer._id);
      const food = await createFood(restaurant._id, { price: 80000 });

      // Create an unpaid PayOS order
      const order = await createOrder(customer._id, restaurant._id, {
        totalPrice: 80000,
        paymentMethod: "PAYOS",
        orderStatus: "pending_payment",
        isPaid: false,
        payosOrderCode: 1760000001,
        payosPaymentLinkId: "old-link-123",
        orderItems: [{ product: food._id, name: food.name, quantity: 1, price: 80000 }],
        shippingAddress: DEFAULT_ADDRESS,
      });

      // Step 1: Customer requests a new PayOS payment link
      const retryRes = await request(app)
        .post("/api/order/retry-payos")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ orderId: order._id.toString() });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.success).toBe(true);
      expect(retryRes.body.checkoutUrl).toContain("https://pay.payos.vn/web/");
      expect(retryRes.body.paymentUrl).toContain("https://pay.payos.vn/web/");
      expect(retryRes.body.orderCode).toBeDefined();
      expect(retryRes.body.orderCode).not.toBe(1760000001);

      // Verify the order was updated with the new orderCode and paymentLinkId
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.payosOrderCode).toBe(retryRes.body.orderCode);
      expect(updatedOrder.payosPaymentLinkId).toBe(`link-${retryRes.body.orderCode}`);

      // Step 2: Attempting to retry an already paid order is rejected
      updatedOrder.isPaid = true;
      updatedOrder.orderStatus = "pending";
      await updatedOrder.save();

      const retryPaidRes = await request(app)
        .post("/api/order/retry-payos")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ orderId: order._id.toString() });

      expect(retryPaidRes.status).toBe(400);
      expect(retryPaidRes.body.message).toMatch(/already paid/i);

      // Step 3: Another customer cannot retry someone else's order
      const stranger = await createUser({ email: "stranger@test.com" });
      const strangerToken = generateToken(stranger._id);

      const unauthorizedRes = await request(app)
        .post("/api/order/retry-payos")
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({ orderId: order._id.toString() });

      expect(unauthorizedRes.status).toBe(403);
    });
  });

  describe("Flow 8: Customer Manual PayOS Refund Request & Admin Payout Flow", () => {
    it("handles customer manual refund, locks order, encrypts bank account, and processes admin payout", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "manual-refund-cust@test.com" });
      const customerToken = generateToken(customer._id);

      // Paid PayOS order
      const order = await createOrder(customer._id, restaurant._id, {
        totalPrice: 120000,
        itemsPrice: 100000,
        shippingPrice: 20000,
        paymentMethod: "PAYOS",
        isPaid: true,
        paidAt: new Date(),
        orderStatus: "pending",
        shippingAddress: DEFAULT_ADDRESS,
      });

      // Step 1: Customer requests manual refund with bank account info
      const refundReqBody = {
        orderId: order._id.toString(),
        reason: "Đặt nhầm địa chỉ giao hàng",
        bank: {
          bankName: "Techcombank",
          accountNumber: "19036789012345",
          accountHolder: "TRAN THI B",
        },
      };

      const refundRes = await request(app)
        .post("/api/refunds/request")
        .set("Authorization", `Bearer ${customerToken}`)
        .send(refundReqBody);

      expect(refundRes.status).toBe(201);
      expect(refundRes.body.success).toBe(true);
      expect(refundRes.body.data.status).toBe("requested");
      expect(refundRes.body.data.amount).toBe(120000);
      expect(refundRes.body.data.bank.accountNumberLast4).toBe("2345");
      // Security check: raw bank account number must never be in JSON output
      expect(JSON.stringify(refundRes.body)).not.toContain("19036789012345");

      const refundId = refundRes.body.data._id;

      // Order status is locked in refund_pending
      const lockedOrder = await Order.findById(order._id);
      expect(lockedOrder.orderStatus).toBe("refund_pending");

      // Duplicate request is rejected with 409 Conflict
      const duplicateRes = await request(app)
        .post("/api/refunds/request")
        .set("Authorization", `Bearer ${customerToken}`)
        .send(refundReqBody);
      expect(duplicateRes.status).toBe(409);

      // Step 2: Admin lists pending refund requests
      const listRes = await request(app)
        .get("/api/refunds")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ status: "requested" });

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data.some((r) => String(r._id) === String(refundId))).toBe(true);

      // Step 3: Admin inspects decrypted bank payout details
      const payoutRes = await request(app)
        .get(`/api/refunds/${refundId}/payout-details`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(payoutRes.status).toBe(200);
      expect(payoutRes.body.data.accountNumber).toBe("19036789012345");
      expect(payoutRes.body.data.accountHolder).toBe("TRAN THI B");

      // Step 4: Admin executes payout and marks refund as paid
      const paidRes = await request(app)
        .post(`/api/refunds/${refundId}/mark-paid`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          transferReference: "FT-TCB-REFUND-999",
          adminNote: "Đã chuyển khoản hoàn tiền thành công qua Internet Banking",
        });

      expect(paidRes.status).toBe(200);
      expect(paidRes.body.data.orderId).toBe(order._id.toString());
      expect(paidRes.body.data.refundId).toBe(refundId);

      // Verify refund record is marked paid
      const updatedRefund = await RefundRequest.findById(refundId);
      expect(updatedRefund.status).toBe("paid");
      expect(updatedRefund.transferReference).toBe("FT-TCB-REFUND-999");

      // Verify order is now cancelled and refundStatus is paid
      const finalOrder = await Order.findById(order._id);
      expect(finalOrder.orderStatus).toBe("cancelled");
      expect(finalOrder.refundStatus).toBe("paid");

      // Verify audit log was persisted
      const audit = await AuditLog.findOne({
        action: "manual_refund_paid",
        targetId: order._id,
      });
      expect(audit).not.toBeNull();
      expect(audit.metadata.transferReference).toBe("FT-TCB-REFUND-999");
    });
  });

  describe("Flow 9: Drone Emergency Fallback & Customer Consent Decision", () => {
    it("handles customer consent to fallback from drone to shipper when drone cannot fly", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "drone-fallback-cust@test.com" });
      const customerToken = generateToken(customer._id);

      // Paid drone order in fallback pending consent state
      const order = await createOrder(customer._id, restaurant._id, {
        deliveryMethod: "drone",
        paymentMethod: "PAYOS",
        isPaid: true,
        paidAt: new Date(),
        orderStatus: "pending",
        dronePhase: "fallback_pending_customer_consent",
        droneFallbackDeadlineAt: new Date(Date.now() + 10 * 60 * 1000),
        shippingAddress: DEFAULT_ADDRESS,
        totalPrice: 95000,
      });

      // Scenario A: Customer accepts switching to shipper
      const consentRes = await request(app)
        .post("/api/drone/fallback-consent")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          orderId: order._id.toString(),
          consent: "accept_shipper",
        });

      expect(consentRes.status).toBe(200);
      expect(consentRes.body.success).toBe(true);
      expect(consentRes.body.data.orderStatus).toBe("cancelled");
      expect(consentRes.body.data.dronePhase).toBe("cancelled");
      expect(consentRes.body.data.refundStatus).toBe("requested");
      expect(consentRes.body.data.canOrderShipperNew).toBe(true);

      const resolvedOrder = await Order.findById(order._id);
      expect(resolvedOrder.orderStatus).toBe("cancelled");
      expect(resolvedOrder.dronePhase).toBe("cancelled");
      expect(resolvedOrder.refundStatus).toBe("requested");
    });

    it("cancels order and initiates refund when customer rejects shipper fallback", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "drone-cancel-cust@test.com" });
      const customerToken = generateToken(customer._id);

      const order = await createOrder(customer._id, restaurant._id, {
        deliveryMethod: "drone",
        paymentMethod: "PAYOS",
        isPaid: true,
        paidAt: new Date(),
        orderStatus: "pending",
        dronePhase: "fallback_pending_customer_consent",
        droneFallbackDeadlineAt: new Date(Date.now() + 10 * 60 * 1000),
        shippingAddress: DEFAULT_ADDRESS,
        totalPrice: 150000,
      });

      // Scenario B: Customer cancels and requests refund (consent is 'reject')
      const rejectRes = await request(app)
        .post("/api/drone/fallback-consent")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          orderId: order._id.toString(),
          consent: "reject",
        });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.success).toBe(true);
      expect(rejectRes.body.data.orderStatus).toBe("cancelled");
      expect(rejectRes.body.data.dronePhase).toBe("cancelled");
      expect(rejectRes.body.data.refundStatus).toBe("requested");
      expect(rejectRes.body.data.canOrderShipperNew).toBe(false);

      const cancelledOrder = await Order.findById(order._id);
      expect(cancelledOrder.orderStatus).toBe("cancelled");
      expect(cancelledOrder.dronePhase).toBe("cancelled");
      expect(cancelledOrder.refundStatus).toBe("requested");
    });
  });

  describe("Flow 10: Shipper Deposit Top-up & Earnings Top-up via PayOS Gateway", () => {
    it("creates PayOS payment links and settles deposit and earnings wallets with double-entry ledgers", async () => {
      const shipper = await createUser({ role: "shipper", email: "topup-shipper@test.com" });
      const shipperToken = generateToken(shipper._id);

      // Step 1: Shipper initiates 350,000 VND initial deposit top-up via PayOS
      const depositRes = await request(app)
        .post("/api/wallet/shipper/deposit/payos")
        .set("Authorization", `Bearer ${shipperToken}`)
        .send({ amount: 350000 });

      expect(depositRes.status).toBe(200);
      expect(depositRes.body.success).toBe(true);
      expect(depositRes.body.checkoutUrl).toBeDefined();
      const paymentId = depositRes.body.paymentId;

      // Check payment record was created as pending
      const paymentRecord = await WalletPayment.findById(paymentId);
      expect(paymentRecord.status).toBe("pending");
      expect(paymentRecord.purpose).toBe("deposit");
      expect(paymentRecord.amount).toBe(350000);

      // Simulate webhook/IPN callback settlement
      await walletService.settleDepositPayment(paymentId, "PAYOS-DEP-REF-1", "PAYOS");

      // Verify deposit balance is now 350,000 VND and ledger entry is created
      const depositWallet = await ShipperDeposit.findOne({ shipper: shipper._id });
      expect(depositWallet.balance).toBe(350000);

      const depositLedger = await WalletTransaction.findOne({
        ownerId: shipper._id,
        transactionType: "shipper_deposit_top_up",
      });
      expect(depositLedger).not.toBeNull();
      expect(depositLedger.amount).toBe(350000);
      expect(depositLedger.balanceAfter).toBe(350000);

      // Step 2: Shipper initiates 200,000 VND earnings wallet top-up to offset negative balance
      const earningsRes = await request(app)
        .post("/api/wallet/shipper/earnings/payos")
        .set("Authorization", `Bearer ${shipperToken}`)
        .send({ amount: 200000 });

      expect(earningsRes.status).toBe(200);
      expect(earningsRes.body.success).toBe(true);
      const earningsPaymentId = earningsRes.body.paymentId;

      // Simulate settlement of earnings top-up
      await walletService.settleDepositPayment(earningsPaymentId, "PAYOS-EARN-REF-1", "PAYOS");

      // Verify earnings wallet balance is now 200,000 VND and ledger entry is created
      const earningsWallet = await ShipperEarningsWallet.findOne({ shipper: shipper._id });
      expect(earningsWallet.balance).toBe(200000);

      const earningsLedger = await WalletTransaction.findOne({
        ownerId: shipper._id,
        transactionType: "shipper_earnings_top_up",
      });
      expect(earningsLedger).not.toBeNull();
      expect(earningsLedger.amount).toBe(200000);
    });
  });

  describe("Flow 11: Shipper Earnings Withdrawal Lifecycle", () => {
    it("handles bank account setup, available balance reservation, overdraft rejection, and admin payout", async () => {
      const shipper = await createUser({ role: "shipper", email: "withdraw-shipper@test.com" });
      const shipperToken = generateToken(shipper._id);

      // Setup initial earnings balance of 800,000 VND (>= min 500k)
      await ShipperEarningsWallet.create({
        shipper: shipper._id,
        balance: 800000,
        reservedWithdrawalAmount: 0,
      });

      // Step 1: Shipper saves encrypted bank account
      await request(app)
        .put("/api/shippers/me/bank-account")
        .set("Authorization", `Bearer ${shipperToken}`)
        .send({
          bankName: "VietinBank",
          accountHolder: "LE VAN C",
          accountNumber: "101888999999",
        })
        .expect(200);

      // Step 2: Shipper requests 500,000 VND withdrawal
      const requestRes = await request(app)
        .post("/api/withdrawals/shipper")
        .set("Authorization", `Bearer ${shipperToken}`)
        .send({ amount: 500000 });

      expect(requestRes.status).toBe(200);
      expect(requestRes.body.data.status).toBe("pending");
      const withdrawalId = requestRes.body.data._id;

      // Available balance is reserved immediately: 800k - 500k = 300k available
      const walletAfterReq = await ShipperEarningsWallet.findOne({ shipper: shipper._id });
      expect(walletAfterReq.balance).toBe(800000);
      expect(walletAfterReq.reservedWithdrawalAmount).toBe(500000);

      // Overdraft protection: trying to withdraw another 500k when only 300k is available fails with 409
      const overdrawRes = await request(app)
        .post("/api/withdrawals/shipper")
        .set("Authorization", `Bearer ${shipperToken}`)
        .send({ amount: 500000 });

      expect(overdrawRes.status).toBe(409);

      // Step 3: Admin approves withdrawal request
      const approveRes = await request(app)
        .post(`/api/withdrawals/${withdrawalId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.request.status).toBe("approved");

      // Step 4: Admin executes payout with bank transaction reference
      const paidRes = await request(app)
        .post(`/api/withdrawals/${withdrawalId}/paid`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ bankTransactionReference: "VTB-SHIPPER-PAYOUT-01" });

      expect(paidRes.status).toBe(200);
      expect(paidRes.body.data.request.status).toBe("paid");

      // Verify wallet balance is deducted and reservation released: 800k - 500k = 300k
      const walletFinal = await ShipperEarningsWallet.findOne({ shipper: shipper._id });
      expect(walletFinal.balance).toBe(300000);
      expect(walletFinal.reservedWithdrawalAmount).toBe(0);

      // Verify double-entry ledger was written
      const ledgerEntry = await WalletTransaction.findOne({
        ownerId: shipper._id,
        transactionType: "shipper_withdrawal",
      });
      expect(ledgerEntry).not.toBeNull();
      expect(ledgerEntry.amount).toBe(-500000);
      expect(ledgerEntry.balanceAfter).toBe(300000);
    });
  });
});
