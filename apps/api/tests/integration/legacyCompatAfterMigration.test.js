import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import {
  AuditLog,
  Branch,
  Merchant,
  Restaurant,
  User,
  WalletTransaction,
} from "../../models/index.cjs";
import { createAdmin, generateToken } from "../helpers.js";

describe("Legacy compatibility after multi-branch migration", () => {
  let admin, adminToken;
  let ownerUser, ownerToken, restaurant, merchant, branch;

  beforeEach(async () => {
    admin = await createAdmin();
    adminToken = generateToken(admin._id);

    // Setup user migrated from restaurant_owner to merchant_owner
    ownerUser = await User.create({
      name: "Chủ Quán Migrated",
      email: `owner-migrated-${Date.now()}@test.com`,
      password: "password123",
      role: "merchant_owner", // Migrated role
    });
    ownerToken = generateToken(ownerUser._id);

    // Legacy restaurant
    restaurant = await Restaurant.create({
      name: "Quán Ăn Cũ",
      owner: ownerUser._id,
      address: "123 Đường Cũ, Q1",
      phone: "0901234567",
      email: ownerUser.email,
      isLocked: false,
      isOpen: true,
      balance: 2000000,
    });

    ownerUser.restaurantId = restaurant._id;
    await ownerUser.save();

    // Migrated Merchant & Branch
    merchant = await Merchant.create({
      name: "Quán Ăn Cũ",
      slug: `quan-an-cu-${Date.now()}`,
      ownerUserId: ownerUser._id,
      status: "active",
      type: "individual",
      branchCount: 1,
      legacyRestaurantId: restaurant._id,
    });

    branch = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh chính",
      code: "MAIN",
      status: "active",
      isOpen: true,
      location: { type: "Point", coordinates: [106.701, 10.775] },
    });
  });

  describe("Wallet endpoints for merchant_owner (Fix 403 -> OK)", () => {
    it("allows merchant_owner to configure and get bank account via GET /api/restaurant/me/bank-account", async () => {
      // First set bank account
      const setRes = await request(app)
        .put("/api/restaurant/me/bank-account")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          bankName: "Vietcombank",
          accountHolder: "CHU QUAN MIGRATED",
          accountNumber: "987654321012",
        });

      expect(setRes.status).toBe(200);
      expect(setRes.body.data.isConfigured).toBe(true);

      // Now fetch bank account via GET
      const getRes = await request(app)
        .get("/api/restaurant/me/bank-account")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.bankName).toBe("Vietcombank");
      expect(getRes.body.data.accountNumberMasked).toBe("•••• 1012");
    });

    it("allows merchant_owner to create and list withdrawals via GET /api/restaurant-withdrawals", async () => {
      // Configure bank account first
      await request(app)
        .put("/api/restaurant/me/bank-account")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          bankName: "Vietcombank",
          accountHolder: "CHU QUAN MIGRATED",
          accountNumber: "987654321012",
        });

      // Request withdrawal
      const postRes = await request(app)
        .post("/api/restaurant-withdrawals")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ amount: 500000 });

      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.data.amount).toBe(500000);

      // List withdrawals via GET
      const listRes = await request(app)
        .get("/api/restaurant-withdrawals")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(listRes.body.data[0].amount).toBe(500000);
    });

    it("allows merchant_owner to list wallet transactions via GET /api/restaurant-withdrawals/transactions", async () => {
      // Seed a ledger transaction
      await WalletTransaction.create({
        walletType: "restaurant_balance",
        ownerType: "restaurant",
        ownerId: restaurant._id,
        amount: -500000,
        balanceBefore: 2500000,
        balanceAfter: 2000000,
        transactionType: "restaurant_withdrawal",
        eventKey: `test:tx:${Date.now()}`,
      });

      const txRes = await request(app)
        .get("/api/restaurant-withdrawals/transactions")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(txRes.status).toBe(200);
      expect(txRes.body.success).toBe(true);
      expect(Array.isArray(txRes.body.data)).toBe(true);
      expect(txRes.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("allows merchant_owner to get wallet balance via GET /api/restaurant-withdrawals/balance with fallback to legacy restaurant balance", async () => {
      const balRes = await request(app)
        .get("/api/restaurant-withdrawals/balance")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(balRes.status).toBe(200);
      expect(balRes.body.success).toBe(true);
      expect(balRes.body.data.balance).toBe(2000000);
      expect(balRes.body.data.availableBalance).toBe(2000000);
    });
  });

  describe("Legacy restaurant lock endpoint (Fix 410 -> OK)", () => {
    it("locks merchant when admin calls PUT /api/restaurant/:id/lock with isLocked=true", async () => {
      const lockRes = await request(app)
        .put(`/api/restaurant/${restaurant._id}/lock`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isLocked: true });

      expect(lockRes.status).toBe(200);
      expect(lockRes.body.success).toBe(true);
      expect(lockRes.body.message).toBe("Đã khóa nhà hàng");

      // Verify Merchant.status is 'suspended'
      const updatedMerchant = await Merchant.findById(merchant._id);
      expect(updatedMerchant.status).toBe("suspended");

      // Verify Branch is closed
      const updatedBranch = await Branch.findById(branch._id);
      expect(updatedBranch.isOpen).toBe(false);

      // Verify Restaurant.isLocked is true
      const updatedRest = await Restaurant.findById(restaurant._id);
      expect(updatedRest.isLocked).toBe(true);

      // Verify Audit log
      const audit = await AuditLog.findOne({
        targetType: "merchant",
        targetId: merchant._id,
        action: "merchant.lock_legacy",
      });
      expect(audit).toBeDefined();
      expect(audit.actor.toString()).toBe(admin._id.toString());
    });

    it("unlocks merchant when admin calls PUT /api/restaurant/:id/lock with isLocked=false", async () => {
      // Suspend merchant first
      merchant.status = "suspended";
      await merchant.save();
      restaurant.isLocked = true;
      await restaurant.save();

      const unlockRes = await request(app)
        .put(`/api/restaurant/${restaurant._id}/lock`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isLocked: false });

      expect(unlockRes.status).toBe(200);
      expect(unlockRes.body.success).toBe(true);
      expect(unlockRes.body.message).toBe("Đã mở khóa nhà hàng");

      // Verify Merchant.status is 'active'
      const updatedMerchant = await Merchant.findById(merchant._id);
      expect(updatedMerchant.status).toBe("active");

      // Verify Restaurant.isLocked is false
      const updatedRest = await Restaurant.findById(restaurant._id);
      expect(updatedRest.isLocked).toBe(false);

      // Verify Audit log
      const audit = await AuditLog.findOne({
        targetType: "merchant",
        targetId: merchant._id,
        action: "merchant.unlock_legacy",
      });
      expect(audit).toBeDefined();
      expect(audit.actor.toString()).toBe(admin._id.toString());
    });

    it("rejects non-admin calling PUT /api/restaurant/:id/lock with 403", async () => {
      const nonAdminRes = await request(app)
        .put(`/api/restaurant/${restaurant._id}/lock`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ isLocked: true });

      expect(nonAdminRes.status).toBe(403);
    });
  });

  describe("Legacy open-state and profile update endpoints (Fix 410 -> OK)", () => {
    it("allows merchant_owner to toggle open-state via PATCH /api/restaurant/:id/open-state and syncs to Branch MAIN", async () => {
      const closeRes = await request(app)
        .patch(`/api/restaurant/${restaurant._id}/open-state`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ isOpen: false });

      expect(closeRes.status).toBe(200);
      expect(closeRes.body.success).toBe(true);

      const branchAfter = await Branch.findOne({ merchantId: merchant._id, code: "MAIN" });
      expect(branchAfter.isOpen).toBe(false);

      const restAfter = await Restaurant.findById(restaurant._id);
      expect(restAfter.isOpen).toBe(false);
    });

    it("allows merchant_owner to update profile via PUT /api/restaurant/:id and syncs to Merchant and Branch MAIN", async () => {
      const updateRes = await request(app)
        .put(`/api/restaurant/${restaurant._id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Quán Ăn Cũ Đổi Tên",
          address: "456 Đường Mới, Q3",
          phone: "0999888777",
          description: "Mô tả mới",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);

      const merchantAfter = await Merchant.findById(merchant._id);
      expect(merchantAfter.name).toBe("Quán Ăn Cũ Đổi Tên");
      expect(merchantAfter.description).toBe("Mô tả mới");

      const branchAfter = await Branch.findOne({ merchantId: merchant._id, code: "MAIN" });
      expect(branchAfter.phone).toBe("0999888777");
    });
  });

  describe("Order list visibility for drone order placed with branchId", () => {
    it("includes drone orders with branchId in GET /api/order/list for the restaurant/merchant owner", async () => {
      const customer = await User.create({
        name: "Khách Mua",
        email: `buyer-${Date.now()}@test.com`,
        password: "password123",
      });

      const { Food, Order } = await import("../../models/index.cjs");
      const food = await Food.create({
        name: "Phở Gà",
        description: "Ngon",
        price: 50000,
        image: "https://example.com/food.jpg",
        category: "Phở",
        merchantId: merchant._id,
      });

      // Place order with branchId
      const droneOrder = await Order.create({
        user: customer._id,
        merchantId: merchant._id,
        branchId: branch._id,
        restaurantId: merchant.legacyRestaurantId || merchant._id,
        orderItems: [{ product: food._id, name: food.name, price: food.price, quantity: 1 }],
        totalPrice: 50000,
        paymentMethod: "VNPAY",
        deliveryMethod: "drone",
        orderStatus: "pending",
        isPaid: true,
        shippingAddress: { fullName: "A", address: "B", city: "C", state: "D", country: "E", phone: "1" },
      });

      const listRes = await request(app)
        .get("/api/order/list")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      const orderIds = listRes.body.data.map((o) => o._id.toString());
      expect(orderIds).toContain(droneOrder._id.toString());
    });

    it("allows merchant_owner to accept order without 403 'Not your merchant' error", async () => {
      const customer = await User.create({
        name: "Khách Đặt",
        email: `buyer2-${Date.now()}@test.com`,
        password: "password123",
      });

      const { Food, Order } = await import("../../models/index.cjs");
      const food = await Food.create({
        name: "Bún Bò",
        description: "Đậm vị",
        price: 55000,
        image: "https://example.com/bun.jpg",
        category: "Bún",
        merchantId: merchant._id,
      });

      const order = await Order.create({
        user: customer._id,
        merchantId: merchant._id,
        branchId: branch._id,
        restaurantId: merchant.legacyRestaurantId || merchant._id,
        orderItems: [{ product: food._id, name: food.name, price: food.price, quantity: 1 }],
        totalPrice: 55000,
        paymentMethod: "COD",
        deliveryMethod: "shipper",
        shipperAssignmentStatus: "accepted",
        orderStatus: "pending",
        shippingAddress: { fullName: "A", address: "B", city: "C", state: "D", country: "E", phone: "1" },
      });

      // Merchant owner accepts order -> status='preparing'
      const acceptRes = await request(app)
        .post("/api/order/status")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          orderId: order._id.toString(),
          status: "preparing",
        });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);

      const updated = await Order.findById(order._id);
      expect(updated.orderStatus).toBe("preparing");
    });

    it("handles PUT /api/restaurant/:id with raw string address without Cast to Embedded error", async () => {
      const updateRes = await request(app)
        .put(`/api/restaurant/${restaurant._id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Cơm Thố Sài Gòn",
          address: "12 Nguyễn Sơn Hà, P. 5, Quận 3, TP. HCM",
          phone: "0909123456",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);

      const branchAfter = await Branch.findOne({ merchantId: merchant._id, code: "MAIN" });
      expect(branchAfter.address.text).toBe("12 Nguyễn Sơn Hà, P. 5, Quận 3, TP. HCM");
    });
  });
});
