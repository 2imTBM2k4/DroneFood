import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import {
  User,
  Restaurant,
  Merchant,
  Branch,
  Food,
  Order,
  Cart,
  Voucher,
  VoucherRedemption,
  WalletTransaction,
  Hub,
  Drone,
} from "../../models/index.cjs";
import {
  createAdmin,
  createFood,
  createRestaurantOwner,
  createUser,
  generateToken,
} from "../helpers.js";
import * as shipperService from "../../services/shipperService.js";
import * as restaurantWithdrawalService from "../../services/restaurantWithdrawalService.js";

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

describe("Comprehensive Business Flows Testing", () => {
  let admin, adminToken;

  beforeEach(async () => {
    admin = await createAdmin();
    adminToken = generateToken(admin._id);
  });

  describe("Flow 1: Auth & Account Locking Security", () => {
    it("immediately denies access when admin locks an active user account", async () => {
      const customer = await createUser({ email: "lock-target@test.com" });
      const customerToken = generateToken(customer._id);

      // Access before lock succeeds
      const beforeLock = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${customerToken}`);
      expect(beforeLock.status).toBe(200);

      // Admin locks the user account using valid schema { userId, locked }
      const lockRes = await request(app)
        .post("/api/user/lock")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ userId: customer._id.toString(), locked: true });
      expect(lockRes.status).toBe(200);

      // Access after lock is blocked immediately with 403 Forbidden
      const afterLock = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${customerToken}`);
      expect(afterLock.status).toBe(403);
      expect(afterLock.body.message).toMatch(/account is locked/i);
    });

    it("blocks restaurant owner when restaurant is pending admin approval or locked", async () => {
      const { owner, restaurant } = await createRestaurantOwner();
      const ownerToken = generateToken(owner._id);

      // Lock the restaurant
      restaurant.isLocked = true;
      await restaurant.save();

      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/pending admin approval/i);
    });
  });

  describe("Flow 2: Inventory Sold-Out Prevention at Checkout", () => {
    it("prevents ordering when a dish is marked sold-out after being added to cart", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "soldout-check@test.com" });
      const customerToken = generateToken(customer._id);
      const food = await createFood(restaurant._id, {
        name: "Com Tam Suon Nuong",
        price: 65000,
        isAvailable: true,
      });

      // Customer adds dish to cart while in stock
      const addRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ itemId: food._id.toString(), quantity: 1 });
      expect(addRes.status).toBe(200);

      // Restaurant marks food as sold-out
      food.isAvailable = false;
      await food.save();

      // Customer attempts to place order
      const orderRes = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          address: DEFAULT_ADDRESS,
          cartId: addRes.body.cartId,
          cartVersion: addRes.body.cartVersion,
          paymentMethod: "COD",
          deliveryMethod: "shipper",
        });

      expect(orderRes.status).toBe(409);
      expect(orderRes.body.message).toContain("hết hàng");
    });
  });

  describe("Flow 3: COD Order Expiry and Voucher Auto-Restitution", () => {
    it("automatically cancels overdue unaccepted COD order and releases customer voucher", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "cod-voucher-restore@test.com" });
      const customerToken = generateToken(customer._id);
      const food = await createFood(restaurant._id, { price: 120000 });

      const voucher = await Voucher.create({
        code: "SALE20K",
        kind: "fixed",
        value: 20000,
        appliesTo: "items_subtotal",
        minOrderAmount: 50000,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        totalQuota: 10,
        perUserQuota: 1,
        usageCount: 0,
        enabled: true,
        createdBy: admin._id,
      });

      const cartRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ itemId: food._id.toString(), quantity: 1 });

      const orderRes = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          address: DEFAULT_ADDRESS,
          cartId: cartRes.body.cartId,
          cartVersion: cartRes.body.cartVersion,
          paymentMethod: "COD",
          deliveryMethod: "shipper",
          voucherCode: "SALE20K",
        });

      expect(orderRes.status).toBe(200);
      const orderId = orderRes.body.orderId;

      // Verify voucher reservation
      const redemptionBefore = await VoucherRedemption.findOne({ order: orderId });
      expect(redemptionBefore.status).toBe("reserved");
      const voucherBefore = await Voucher.findById(voucher._id);
      expect(voucherBefore.usageCount).toBe(1);

      // Fast-forward order assignment deadline to simulate 15-min timeout
      await Order.updateOne(
        { _id: orderId },
        { $set: { shipperAssignmentDeadlineAt: new Date(Date.now() - 1000) } }
      );

      // Trigger background expiration routine
      const expireResult = await shipperService.expireUnacceptedOrders();
      expect(expireResult.cancelledCount).toBeGreaterThanOrEqual(1);

      // Verify order is cancelled and voucher is released back to customer
      const expiredOrder = await Order.findById(orderId);
      expect(expiredOrder.orderStatus).toBe("cancelled");
      expect(expiredOrder.cancellationCode).toBe("NO_SHIPPER_AVAILABLE");

      const redemptionAfter = await VoucherRedemption.findOne({ order: orderId });
      expect(redemptionAfter.status).toBe("released");
      const voucherAfter = await Voucher.findById(voucher._id);
      expect(voucherAfter.usageCount).toBe(0);
    });
  });

  describe("Flow 4: Zero-Payable Voucher Order Lifecycle", () => {
    it("handles 100% discount voucher order as paid without gateway redirect", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "zero-payable@test.com" });
      const customerToken = generateToken(customer._id);
      const food = await createFood(restaurant._id, { price: 50000 });

      // Create 100% voucher covering entire food price
      await Voucher.create({
        code: "FREEFOOD50K",
        kind: "fixed",
        value: 50000,
        appliesTo: "items_subtotal",
        minOrderAmount: 0,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        totalQuota: 10,
        perUserQuota: 1,
        usageCount: 0,
        enabled: true,
        createdBy: admin._id,
      });

      const cartRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ itemId: food._id.toString(), quantity: 1 });

      const orderRes = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          address: DEFAULT_ADDRESS,
          cartId: cartRes.body.cartId,
          cartVersion: cartRes.body.cartVersion,
          paymentMethod: "PAYOS",
          deliveryMethod: "shipper",
          voucherCode: "FREEFOOD50K",
        });

      expect(orderRes.status).toBe(200);
      expect(orderRes.body.zeroPayableVoucherCheckout).toBe(true);
      expect(orderRes.body.paymentUrl).toBeFalsy();

      const order = await Order.findById(orderRes.body.orderId);
      expect(order.isPaid).toBe(true);
      expect(order.totalPrice).toBe(0);
      expect(order.orderStatus).toBe("pending");
    });
  });

  describe("Flow 5: Restaurant Withdrawal & Wallet Balance Management", () => {
    it("manages available balance reservation, approval and paid ledger entries", async () => {
      const { owner, restaurant } = await createRestaurantOwner();
      const ownerToken = generateToken(owner._id);

      // Setup initial restaurant wallet balance (1,500,000 VND >= min 500k)
      restaurant.balance = 1500000;
      await restaurant.save();

      // Configure bank account properly with encrypted storage via API
      await request(app)
        .put("/api/restaurant/me/bank-account")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          bankName: "Techcombank",
          accountHolder: "NGUYEN VAN CHU QUAN",
          accountNumber: "19034567890123",
        })
        .expect(200);

      // Check balance before withdrawal
      const balanceBefore = await restaurantWithdrawalService.getBalance(owner);
      expect(balanceBefore.balance).toBe(1500000);
      expect(balanceBefore.availableBalance).toBe(1500000);

      // Step 1: Owner requests 600,000 VND withdrawal (minimum allowed is 500,000 VND)
      const requestRes = await request(app)
        .post("/api/restaurant-withdrawals")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ amount: 600000 });
      expect(requestRes.status).toBe(200);
      const withdrawalId = requestRes.body.data._id;

      // Available balance is reserved immediately: 1,500,000 - 600,000 = 900,000 VND
      const balanceAfterRequest = await restaurantWithdrawalService.getBalance(owner);
      expect(balanceAfterRequest.balance).toBe(1500000);
      expect(balanceAfterRequest.reservedWithdrawalAmount).toBe(600000);
      expect(balanceAfterRequest.availableBalance).toBe(900000);

      // Attempting to withdraw more than available balance (1,000,000 > 900,000) is rejected
      const overdrawRes = await request(app)
        .post("/api/restaurant-withdrawals")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ amount: 1000000 });
      expect(overdrawRes.status).toBe(409);

      // Step 2: Admin approves the request
      const approveRes = await request(app)
        .post(`/api/restaurant-withdrawals/${withdrawalId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(approveRes.status).toBe(200);

      // Step 3: Admin executes payout and marks it as paid with bank reference
      const paidRes = await request(app)
        .post(`/api/restaurant-withdrawals/${withdrawalId}/paid`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ bankTransactionReference: "FT26294819034567" });
      expect(paidRes.status).toBe(200);

      // Verify wallet balance is deducted and reservation released: 1,500,000 - 600,000 = 900,000 VND
      const balanceFinal = await restaurantWithdrawalService.getBalance(owner);
      expect(balanceFinal.balance).toBe(900000);
      expect(balanceFinal.reservedWithdrawalAmount).toBe(0);
      expect(balanceFinal.availableBalance).toBe(900000);

      // Verify ledger entry is written for accounting audit
      const ledgerEntry = await WalletTransaction.findOne({
        ownerId: restaurant._id,
        transactionType: "restaurant_withdrawal",
      });
      expect(ledgerEntry).not.toBeNull();
      expect(ledgerEntry.amount).toBe(-600000);
      expect(ledgerEntry.balanceAfter).toBe(900000);
    });
  });

  describe("Flow 6: Drone Delivery Lifecycle & Automated Restaurant Settlement", () => {
    it("completes drone dispatch, handover, customer confirmation and settles restaurant 80% share", async () => {
      const { owner, restaurant } = await createRestaurantOwner();
      const ownerToken = generateToken(owner._id);

      // Create operational Merchant & Main Branch with approved drone delivery application
      const merchant = await Merchant.create({
        name: "Test Merchant Drone",
        slug: `merchant-drone-${Date.now()}`,
        ownerUserId: owner._id,
        legacyRestaurantId: restaurant._id,
        status: "active",
      });
      await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhanh Drone",
        code: "MAIN",
        isOpen: true,
        status: "active",
        location: { type: "Point", coordinates: [106.7009, 10.7769] },
        droneDeliveryEnabled: true,
        droneDeliveryApplication: {
          status: "approved",
        },
      });

      const customer = await createUser({ email: "drone-settle@test.com" });
      const customerToken = generateToken(customer._id);
      const food = await createFood(restaurant._id, { price: 200000 });

      // Create Hub and Drone
      const hub = await Hub.create({
        name: "Hub Drone Q1",
        code: `HUB-Q1-${Date.now()}`,
        address: { text: "123 Le Duan, Q1", lat: 10.7769, lng: 106.7009 },
        location: { type: "Point", coordinates: [106.7009, 10.7769] },
        status: "active",
      });
      const drone = await Drone.create({
        hubId: hub._id,
        droneCode: `DRONE-ST-${Date.now()}`,
        status: "available",
        batteryLevel: 90,
      });

      // Customer adds food to cart and places drone delivery order
      const cartRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ itemId: food._id.toString(), quantity: 1 });

      const placeRes = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          address: DEFAULT_ADDRESS,
          cartId: cartRes.body.cartId,
          cartVersion: cartRes.body.cartVersion,
          paymentMethod: "VNPAY",
          deliveryMethod: "drone",
        });
      expect(placeRes.status).toBe(200);
      const orderId = placeRes.body.orderId;

      // Simulate online payment confirmation
      await Order.findByIdAndUpdate(orderId, {
        isPaid: true,
        orderStatus: "pending",
      });

      // 1. Dispatch drone
      const { dispatchPaidDroneOrder } = await import("../../services/droneService.js");
      const dispatchRes = await dispatchPaidDroneOrder(orderId);
      expect(dispatchRes.success).toBe(true);
      expect(dispatchRes.droneDispatched).toBe(true);

      // 2. Preflight check passes
      await request(app)
        .post("/api/drone/preflight")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          orderId,
          passed: true,
          checklist: { rotors: "ok", gps: "ok" },
        })
        .expect(200);

      // 3. Drone arrives at restaurant
      await request(app)
        .post("/api/drone/arrived-restaurant")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ orderId })
        .expect(200);

      // 4. Restaurant hands over order -> QR code generated
      const handoverRes = await request(app)
        .post("/api/drone/handover")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ orderId });
      expect(handoverRes.status).toBe(200);
      const qrCode = handoverRes.body.data.qrCode;
      expect(qrCode).toBeTruthy();

      // 5. Drone arrives at customer
      const { recordDroneArrivedCustomer } = await import("../../services/droneService.js");
      await recordDroneArrivedCustomer(orderId);

      // 6. Customer scans QR code
      const scanRes = await request(app)
        .post("/api/drone/scan-qr")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ orderId, qrCode });
      expect(scanRes.status).toBe(200);

      // 7. Customer confirms delivery
      const confirmRes = await request(app)
        .post("/api/drone/confirm-delivery")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ orderId });
      expect(confirmRes.status).toBe(200);

      // Verify order is delivered
      const deliveredOrder = await Order.findById(orderId);
      expect(deliveredOrder.orderStatus).toBe("delivered");
      expect(deliveredOrder.dronePhase).toBe("delivered");

      // Verify restaurant wallet balance increased by 80% (160,000 VND out of 200,000 VND)
      const updatedRestaurant = await Restaurant.findById(restaurant._id);
      expect(updatedRestaurant.balance).toBe(160000);

      // Verify ledger transaction was created
      const settlementLedger = await WalletTransaction.findOne({
        orderId,
        transactionType: "restaurant_order_settlement",
      });
      expect(settlementLedger).not.toBeNull();
      expect(settlementLedger.amount).toBe(160000);
      expect(settlementLedger.balanceAfter).toBe(160000);
    });
  });
});
