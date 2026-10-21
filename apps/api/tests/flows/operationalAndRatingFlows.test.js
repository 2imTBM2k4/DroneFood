import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";

vi.mock("../../utils/distance.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getRoadDistanceKm: vi.fn(async () => 2.5),
  };
});
import {
  AuditLog,
  Branch,
  Cart,
  Drone,
  Food,
  Hub,
  Merchant,
  Order,
  OrderReview,
  Restaurant,
  ShipperDeposit,
  ShipperProfile,
  User,
} from "../../models/index.cjs";
import {
  createAdmin,
  createFood,
  createOrder,
  createRestaurantOwner,
  createUser,
  generateToken,
} from "../helpers.js";

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

describe("Operational, Rating & Food Availability Business Flows (Group 2)", () => {
  let admin, adminToken;

  beforeEach(async () => {
    admin = await createAdmin();
    adminToken = generateToken(admin._id);
  });

  describe("Flow 12: Order Review & Rating Lifecycle", () => {
    it("enforces review sequence (shipper before food), records rating/comment, and updates food reviews", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "reviewer-cust@test.com" });
      const customerToken = generateToken(customer._id);
      const shipper = await createUser({ role: "shipper", name: "Anh Shipper Nhanh Nhen" });
      const food = await createFood(restaurant._id, { name: "Pho Bo Dac Biet", price: 65000 });

      // Create a delivered order
      const order = await createOrder(customer._id, restaurant._id, {
        orderStatus: "delivered",
        isDelivered: true,
        deliveryMethod: "shipper",
        shipperId: shipper._id,
        orderItems: [{ product: food._id, name: food.name, quantity: 1, price: 65000 }],
        shippingAddress: DEFAULT_ADDRESS,
      });

      // Step 1: Customer tries to review food before reviewing the shipper -> MUST FAIL with 409 Conflict
      const earlyFoodReview = await request(app)
        .post(`/api/order-reviews/${order._id}/food/${food._id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ outcome: "rated", rating: 5, comment: "Tuyệt vời" });

      expect(earlyFoodReview.status).toBe(409);
      expect(earlyFoodReview.body.message).toMatch(/previous review/i);

      // Step 2: Customer rates the shipper first
      const shipperReviewRes = await request(app)
        .post(`/api/order-reviews/${order._id}/shipper/${shipper._id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ outcome: "rated", rating: 5 });

      expect(shipperReviewRes.status).toBe(201);
      expect(shipperReviewRes.body.data.reviewFlow.nextTarget).toMatchObject({
        targetType: "food",
        targetId: food._id.toString(),
      });

      // Step 3: Customer rates the food with comment
      const foodReviewRes = await request(app)
        .post(`/api/order-reviews/${order._id}/food/${food._id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ outcome: "rated", rating: 5, comment: "Món ăn nóng hổi, rất vừa miệng!" });

      expect(foodReviewRes.status).toBe(201);
      expect(foodReviewRes.body.data.reviewFlow.complete).toBe(true);

      // Step 4: Duplicate review on the same target is rejected with 409
      const duplicateReview = await request(app)
        .post(`/api/order-reviews/${order._id}/food/${food._id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ outcome: "rated", rating: 4 });

      expect(duplicateReview.status).toBe(409);

      // Step 5: Public food review endpoint displays the new review
      const foodReviewsListRes = await request(app)
        .get(`/api/order-reviews/food/${food._id}`);

      expect(foodReviewsListRes.status).toBe(200);
      expect(foodReviewsListRes.body.success).toBe(true);
      expect(foodReviewsListRes.body.data.ratingCount).toBe(1);
      expect(foodReviewsListRes.body.data.reviews[0].comment).toBe("Món ăn nóng hổi, rất vừa miệng!");
      expect(foodReviewsListRes.body.data.reviews[0].rating).toBe(5);
    });
  });

  describe("Flow 13: Shipper Order Decline & Audit Trail", () => {
    it("allows an approved shipper to decline an available order with recorded audit trail", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "decline-test-cust@test.com" });
      const shipper = await createUser({ role: "shipper", email: "declining-shipper@test.com" });
      const shipperToken = generateToken(shipper._id);

      await ShipperProfile.create({
        user: shipper._id,
        approvalStatus: "approved",
        status: "available",
        currentLocation: { type: "Point", coordinates: [106.7009, 10.7769] },
        locationUpdatedAt: new Date(),
      });
      await ShipperDeposit.create({ shipper: shipper._id, balance: 350000 });

      // Create an unassigned order
      const order = await createOrder(customer._id, restaurant._id, {
        deliveryMethod: "shipper",
        paymentMethod: "COD",
        orderStatus: "pending",
        shipperAssignmentStatus: "unassigned",
        shipperAssignmentDeadlineAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      // Shipper declines order with reason
      const declineRes = await request(app)
        .post(`/api/shippers/me/orders/${order._id}/decline`)
        .set("Authorization", `Bearer ${shipperToken}`)
        .send({ reason: "Xe bị thủng lốp đột xuất" });

      expect(declineRes.status).toBe(200);
      expect(declineRes.body.success).toBe(true);

      // Verify the order remains unassigned so another shipper can still claim it
      const orderStillAvailable = await Order.findById(order._id);
      expect(orderStillAvailable.shipperAssignmentStatus).toBe("unassigned");
      expect(orderStillAvailable.shipperId).toBeNull();

      // Verify audit log entry was created
      const auditLog = await AuditLog.findOne({
        action: "shipper.order_declined",
        targetId: order._id,
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog.reason).toBe("Xe bị thủng lốp đột xuất");
      expect(auditLog.actor.toString()).toBe(shipper._id.toString());
    });
  });

  describe("Flow 14: Admin Hub Management CRUD & Drone Assignment Safety Guard", () => {
    it("protects hub management, updates coordinates, and prevents deleting a hub with active drones", async () => {
      const normalUser = await createUser();
      const userToken = generateToken(normalUser._id);

      const hubPayload = {
        name: "Hub Trung Tam Quan 3",
        code: `HUB-Q3-${Date.now()}`,
        address: {
          text: "200 CMT8, Phuong 10, Quan 3",
          lat: 10.778,
          lng: 106.685,
        },
        capacity: 10,
        note: "Trạm thử nghiệm bay Drone Q3",
      };

      // Step 1: Normal user cannot create a hub -> 403 Forbidden
      const unauthRes = await request(app)
        .post("/api/hub")
        .set("Authorization", `Bearer ${userToken}`)
        .send(hubPayload);
      expect(unauthRes.status).toBe(403);

      // Step 2: Admin creates Hub
      const createRes = await request(app)
        .post("/api/hub")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(hubPayload);

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      const hubId = createRes.body.data._id;
      expect(createRes.body.data.code).toBe(hubPayload.code);

      // Step 3: Admin gets Hub by ID and lists Hubs
      const getRes = await request(app)
        .get(`/api/hub/${hubId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe(hubPayload.name);

      const listRes = await request(app)
        .get("/api/hub")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((h) => h._id === hubId)).toBe(true);

      // Step 4: Admin updates Hub status to inactive
      const updateRes = await request(app)
        .put(`/api/hub/${hubId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "inactive" });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe("inactive");

      // Step 5: Safety Guard: create a Drone linked to this Hub, then attempt deletion
      const drone = await Drone.create({
        hubId,
        droneCode: `DRONE-SAFETY-${Date.now()}`,
        status: "available",
        batteryLevel: 100,
      });

      const deleteBlockedRes = await request(app)
        .delete(`/api/hub/${hubId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(deleteBlockedRes.status).toBe(400);
      expect(deleteBlockedRes.body.message).toMatch(/Không thể xóa Hub đang quản lý/i);

      // Step 6: Remove drone first, then delete Hub successfully
      await Drone.findByIdAndDelete(drone._id);

      const deleteSuccessRes = await request(app)
        .delete(`/api/hub/${hubId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(deleteSuccessRes.status).toBe(200);
      expect(deleteSuccessRes.body.success).toBe(true);

      const hubAfterDelete = await Hub.findById(hubId);
      expect(hubAfterDelete).toBeNull();
    });
  });

  describe("Flow 15: Branch-Level Food Availability & Checkout Guard", () => {
    it("marks food unavailable at a specific branch, blocks checkout for that branch, and allows other branch", async () => {
      const owner = await createUser({ role: "merchant_owner" });
      const ownerToken = generateToken(owner._id);

      // Create a brand with 2 branches
      const merchant = await Merchant.create({
        name: "Com Ga Thuong Hieu",
        slug: `com-ga-th-${Date.now()}`,
        ownerUserId: owner._id,
        status: "active",
        type: "brand",
        branchCount: 2,
      });

      const branchA = await Branch.create({
        merchantId: merchant._id,
        name: "Chi Nhanh A (Quan 1)",
        code: "CNA",
        status: "active",
        isOpen: true,
        location: { type: "Point", coordinates: [106.7009, 10.7769] },
      });

      const branchB = await Branch.create({
        merchantId: merchant._id,
        name: "Chi Nhanh B (Quan 3)",
        code: "CNB",
        status: "active",
        isOpen: true,
        location: { type: "Point", coordinates: [106.685, 10.778] },
      });

      const food = await Food.create({
        merchantId: merchant._id,
        name: "Com Ga Xoi Mo",
        description: "Com ga gion thom",
        price: 55000,
        image: "https://example.com/com-ga.jpg",
        category: "Com",
        isAvailable: true,
        unavailableBranchIds: [],
      });

      const customer = await createUser({ email: "branch-food-cust@test.com" });
      const customerToken = generateToken(customer._id);

      // Step 1: Customer adds dish to cart at Branch A while still available
      const cartARes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          itemId: food._id.toString(),
          quantity: 1,
          branchId: branchA._id.toString(),
        });
      expect(cartARes.status).toBe(200);

      // Step 2: Owner marks food unavailable ONLY at Branch A
      const patchRes = await request(app)
        .patch(`/api/food/${food._id}/branch-availability`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          branchId: branchA._id.toString(),
          isAvailable: false,
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);

      const updatedFood = await Food.findById(food._id);
      expect(updatedFood.unavailableBranchIds.map((id) => id.toString())).toContain(branchA._id.toString());
      expect(updatedFood.unavailableBranchIds.map((id) => id.toString())).not.toContain(branchB._id.toString());

      // Step 3: Customer attempts to checkout at Branch A -> MUST BE REJECTED with 409 Conflict
      const checkoutAFail = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          address: DEFAULT_ADDRESS,
          cartId: cartARes.body.cartId,
          cartVersion: cartARes.body.cartVersion,
          branchId: branchA._id.toString(),
          paymentMethod: "COD",
          deliveryMethod: "shipper",
        });

      expect(checkoutAFail.status).toBe(409);
      expect(checkoutAFail.body.message).toContain("tạm hết tại chi nhánh này");

      // Verify direct add to cart at Branch A is now also blocked with 409
      const addUnavailableFail = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          itemId: food._id.toString(),
          quantity: 1,
          branchId: branchA._id.toString(),
        });
      expect(addUnavailableFail.status).toBe(409);

      // Step 4: Customer clears cart and adds dish at Branch B (where it is still available)
      await request(app)
        .delete(`/api/cart/${cartARes.body.cartId}`)
        .set("Authorization", `Bearer ${customerToken}`);

      const cartBRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          itemId: food._id.toString(),
          quantity: 1,
          branchId: branchB._id.toString(),
        });
      expect(cartBRes.status).toBe(200);

      // Step 5: Checkout at Branch B succeeds!
      const checkoutBSuccess = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          address: DEFAULT_ADDRESS,
          cartId: cartBRes.body.cartId,
          cartVersion: cartBRes.body.cartVersion,
          branchId: branchB._id.toString(),
          paymentMethod: "COD",
          deliveryMethod: "shipper",
        });

      expect(checkoutBSuccess.status).toBe(200);
      expect(checkoutBSuccess.body.success).toBe(true);
      expect(checkoutBSuccess.body.orderId).toBeDefined();

      const placedOrder = await Order.findById(checkoutBSuccess.body.orderId);
      expect(placedOrder.branchId.toString()).toBe(branchB._id.toString());
      expect(placedOrder.orderStatus).toBe("pending");
    });
  });
});
