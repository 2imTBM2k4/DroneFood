import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../app.js";
import { Branch, Cart, Drone, Food, Hub, Merchant, Order, User } from "../../models/index.cjs";
import { createAdmin, createUser, generateToken } from "../helpers.js";

describe("Phase 2 Multi-Branch Endpoints Integration", () => {
  let admin, adminToken;
  let owner, ownerToken, merchant, branch1, branch2;
  let manager, managerToken;
  let customer, customerToken;
  let food1;

  beforeEach(async () => {
    admin = await createAdmin();
    adminToken = generateToken(admin._id);

    owner = await createUser({
      name: "Chủ Chuỗi",
      email: `owner-${Date.now()}-${Math.random()}@test.com`,
      role: "merchant_owner",
    });
    ownerToken = generateToken(owner._id);

    manager = await createUser({
      name: "Quản Lý Chi Nhánh 1",
      email: `manager-${Date.now()}-${Math.random()}@test.com`,
      role: "branch_manager",
    });
    managerToken = generateToken(manager._id);

    customer = await createUser({
      name: "Khách Hàng",
      email: `customer-${Date.now()}-${Math.random()}@test.com`,
      role: "user",
    });
    customerToken = generateToken(customer._id);

    merchant = await Merchant.create({
      name: "Phở Ba Miền",
      slug: `pho-ba-mien-${Date.now()}`,
      ownerUserId: owner._id,
      status: "active",
      type: "brand",
    });

    branch1 = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh 1 (Q1)",
      code: "Q1",
      status: "active",
      isOpen: true,
      droneDeliveryEnabled: true,
      managerUserIds: [manager._id],
      location: { type: "Point", coordinates: [106.701, 10.775] },
      address: { text: "1 Đồng Khởi, Q1", lat: 10.775, lng: 106.701 },
    });

    branch2 = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh 2 (Q3)",
      code: "Q3",
      status: "active",
      isOpen: true,
      droneDeliveryEnabled: false,
      managerUserIds: [],
      location: { type: "Point", coordinates: [106.690, 10.780] },
      address: { text: "2 Võ Văn Tần, Q3", lat: 10.780, lng: 106.690 },
    });

    food1 = await Food.create({
      name: "Phở Tái",
      description: "Thơm ngon",
      price: 60000,
      image: "https://example.com/pho.jpg",
      category: "Món nước",
      merchantId: merchant._id,
    });
  });

  describe("Cart multi-branch constraints", () => {
    it("rejects passing both branchId and restaurantId with 400", async () => {
      const res = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          itemId: food1._id.toString(),
          quantity: 1,
          branchId: branch1._id.toString(),
          restaurantId: branch1._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("adds item with branchId and sets branchId + merchantId on cart", async () => {
      const res = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          itemId: food1._id.toString(),
          quantity: 2,
          branchId: branch1._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.branchId).toBe(branch1._id.toString());
      expect(res.body.merchantId).toBe(merchant._id.toString());
    });

    it("rejects adding an item from a different branch when cart already exists (409)", async () => {
      // Add first item to branch1
      await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          itemId: food1._id.toString(),
          quantity: 1,
          branchId: branch1._id.toString(),
        });

      // Try adding to branch2
      const res = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          itemId: food1._id.toString(),
          quantity: 1,
          branchId: branch2._id.toString(),
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("Giỏ hàng chỉ chứa món từ 1 chi nhánh");
    });
  });

  describe("Order placement with branchId", () => {
    let customerCart;

    beforeEach(async () => {
      const addRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          itemId: food1._id.toString(),
          quantity: 1,
          branchId: branch1._id.toString(),
        });
      customerCart = addRes.body;
    });

    it("places an order with valid branchId and stores branchId + merchantId", async () => {
      const res = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          cartId: customerCart.cartId,
          cartVersion: customerCart.cartVersion,
          branchId: branch1._id.toString(),
          paymentMethod: "COD",
          deliveryMethod: "shipper",
          address: {
            fullName: "Nguyễn Văn Khách",
            phone: "0900000001",
            address: "1 Đồng Khởi, Q1",
            city: "TP HCM",
            state: "TP HCM",
            country: "Vietnam",
            lat: 10.775,
            lng: 106.701,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.branchId).toBe(branch1._id.toString());
      expect(res.body.merchantId).toBe(merchant._id.toString());

      const createdOrder = await Order.findById(res.body.orderId);
      expect(createdOrder.branchId.toString()).toBe(branch1._id.toString());
      expect(createdOrder.merchantId.toString()).toBe(merchant._id.toString());
    });

    it("rejects placeOrder when the supplied branchId differs from the cart (400)", async () => {
      const nonExistentBranchId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          cartId: customerCart.cartId,
          cartVersion: customerCart.cartVersion,
          branchId: nonExistentBranchId,
          paymentMethod: "COD",
          deliveryMethod: "shipper",
          address: {
            fullName: "Khách",
            phone: "0900000001",
            address: "10 Nguyễn Trãi",
            city: "TP HCM",
            state: "TP HCM",
            country: "VN",
            lat: 10.772,
            lng: 106.702,
          },
        });

      expect(res.status).toBe(400);
    });

    it("rejects placeOrder when branch is locked (403)", async () => {
      await Branch.findByIdAndUpdate(branch1._id, { status: "locked" });

      const res = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          cartId: customerCart.cartId,
          cartVersion: customerCart.cartVersion,
          branchId: branch1._id.toString(),
          paymentMethod: "COD",
          deliveryMethod: "shipper",
          address: {
            fullName: "Khách",
            phone: "0900000001",
            address: "10 Nguyễn Trãi",
            city: "TP HCM",
            state: "TP HCM",
            country: "VN",
            lat: 10.772,
            lng: 106.702,
          },
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Chi nhánh không hoạt động");
    });

    it("rejects placeOrder when body.branchId does not match cart.branchId (400)", async () => {
      const res = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          cartId: customerCart.cartId,
          cartVersion: customerCart.cartVersion,
          branchId: branch2._id.toString(), // cart is branch1
          paymentMethod: "COD",
          deliveryMethod: "shipper",
          address: {
            fullName: "Khách",
            phone: "0900000001",
            address: "10 Nguyễn Trãi",
            city: "TP HCM",
            state: "TP HCM",
            country: "VN",
            lat: 10.772,
            lng: 106.702,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Giỏ hàng không khớp với chi nhánh đặt hàng");
    });
  });

  describe("Order listing & status update permissions", () => {
    let orderBranch1, orderBranch2;

    beforeEach(async () => {
      orderBranch1 = await Order.create({
        user: customer._id,
        merchantId: merchant._id,
        branchId: branch1._id,
        orderItems: [{ product: food1._id, name: food1.name, price: food1.price, quantity: 1 }],
        totalPrice: 60000,
        paymentMethod: "COD",
        deliveryMethod: "drone",
        orderStatus: "pending",
        shippingAddress: { fullName: "A", address: "B", city: "C", state: "D", country: "E", phone: "1" },
      });

      orderBranch2 = await Order.create({
        user: customer._id,
        merchantId: merchant._id,
        branchId: branch2._id,
        orderItems: [{ product: food1._id, name: food1.name, price: food1.price, quantity: 1 }],
        totalPrice: 60000,
        paymentMethod: "COD",
        deliveryMethod: "drone",
        orderStatus: "pending",
        shippingAddress: { fullName: "A", address: "B", city: "C", state: "D", country: "E", phone: "1" },
      });
    });

    it("allows merchant_owner to see orders across all branches of their merchant", async () => {
      const res = await request(app)
        .get("/api/order/list")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((o) => o._id.toString());
      expect(ids).toContain(orderBranch1._id.toString());
      expect(ids).toContain(orderBranch2._id.toString());
    });

    it("restricts branch_manager to only see orders of branches they manage", async () => {
      const res = await request(app)
        .get("/api/order/list")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((o) => o._id.toString());
      expect(ids).toContain(orderBranch1._id.toString());
      expect(ids).not.toContain(orderBranch2._id.toString());
    });

    it("blocks branch_manager from querying orders of a branch they do not manage (403)", async () => {
      const res = await request(app)
        .get("/api/order/list")
        .set("Authorization", `Bearer ${managerToken}`)
        .query({ branchId: branch2._id.toString() });

      expect(res.status).toBe(403);
    });

    it("allows branch_manager to update status of their managed branch order and blocks for other branch", async () => {
      // Allowed for branch1
      const okRes = await request(app)
        .post("/api/order/status")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          orderId: orderBranch1._id.toString(),
          status: "preparing",
        });
      expect(okRes.status).toBe(200);

      // Blocked for branch2
      const blockRes = await request(app)
        .post("/api/order/status")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          orderId: orderBranch2._id.toString(),
          status: "preparing",
        });
      expect(blockRes.status).toBe(403);
    });
  });

  describe("Drone assignment per branch", () => {
    let orderBranch1;
    let drone1;

    beforeEach(async () => {
      const hub = await Hub.create({
        name: "Hub 1",
        code: `HUB-1-${Date.now()}`,
        location: { type: "Point", coordinates: [106.701, 10.775] },
        status: "active",
      });

      orderBranch1 = await Order.create({
        user: customer._id,
        merchantId: merchant._id,
        branchId: branch1._id,
        orderItems: [{ product: food1._id, name: food1.name, price: food1.price, quantity: 1 }],
        totalPrice: 60000,
        paymentMethod: "COD",
        deliveryMethod: "drone",
        orderStatus: "pending",
        shippingAddress: { fullName: "A", address: "B", city: "C", state: "D", country: "E", phone: "1" },
      });

      drone1 = await Drone.create({
        hubId: hub._id,
        droneCode: `D-B1-${Date.now()}`,
        status: "available",
        batteryLevel: 90,
      });
    });

    it("assigns available drone from hub to order", async () => {
      const res = await request(app)
        .post("/api/drone/assign")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          orderId: orderBranch1._id.toString(),
          droneId: drone1._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.data.droneId.toString()).toBe(drone1._id.toString());
    });

    it("rejects assigning unavailable drone with 409", async () => {
      await Drone.findByIdAndUpdate(drone1._id, { status: "delivering" });
      const res = await request(app)
        .post("/api/drone/assign")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          orderId: orderBranch1._id.toString(),
          droneId: drone1._id.toString(),
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("Không có drone khả dụng");
    });
  });

  describe("Audit log filtering by merchantId and branchId", () => {
    it("allows merchant_owner to filter audit logs of their own merchant and rejects for other merchant (403)", async () => {
      const otherMerchant = await Merchant.create({
        name: "Khác",
        slug: `khac-${Date.now()}`,
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
      });

      // Filter own merchant
      const ownRes = await request(app)
        .get("/api/audit")
        .set("Authorization", `Bearer ${ownerToken}`)
        .query({ merchantId: merchant._id.toString() });
      expect(ownRes.status).toBe(200);

      // Filter other merchant -> 403
      const otherRes = await request(app)
        .get("/api/audit")
        .set("Authorization", `Bearer ${ownerToken}`)
        .query({ merchantId: otherMerchant._id.toString() });
      expect(otherRes.status).toBe(403);
    });
  });

  describe("Food management & query", () => {
    it("rejects adding food for a merchant user does not own (403)", async () => {
      const res = await request(app)
        .post("/api/food/add")
        .set("Authorization", `Bearer ${managerToken}`) // manager is not owner of merchant
        .send({
          name: "Món Hack",
          description: "Mô tả",
          price: 50000,
          category: "Món mới",
          merchantId: merchant._id.toString(),
        });

      expect(res.status).toBe(403);
    });

    it("lists food by branchId by resolving to merchantId", async () => {
      const res = await request(app)
        .get("/api/food/list")
        .query({ branchId: branch1._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.some((f) => f.name === "Phở Tái")).toBe(true);
    });
  });

  describe("Legacy API alias warning", () => {
    it("logs a [LEGACY API] warning when calling /api/restaurant/list", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const res = await request(app).get("/api/restaurant/list");
      expect(res.status).toBe(200);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[LEGACY API]")
      );
      warnSpy.mockRestore();
    });
  });
});
