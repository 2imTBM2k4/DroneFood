import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../app.js";
import { Branch, Merchant, User } from "../../models/index.cjs";
import { createAdmin, createRestaurantOwner, createUser, generateToken } from "../helpers.js";

describe("My Branches & Multi-Branch Access Integration", () => {
  let admin, adminToken;
  let owner, ownerToken;
  let manager1, manager1Token;
  let manager2, manager2Token;
  let unassignedManager, unassignedManagerToken;
  let customer, customerToken;
  let merchant, branch1, branch2;

  beforeEach(async () => {
    admin = await createAdmin();
    adminToken = generateToken(admin._id);

    owner = await createUser({
      name: "Chủ Chuỗi Phở",
      role: "merchant_owner",
    });
    ownerToken = generateToken(owner._id);

    manager1 = await createUser({
      name: "Quản Lý Quận 1",
      role: "branch_manager",
    });
    manager1Token = generateToken(manager1._id);

    manager2 = await createUser({
      name: "Quản Lý Quận 3",
      role: "branch_manager",
    });
    manager2Token = generateToken(manager2._id);

    unassignedManager = await createUser({
      name: "Quản Lý Chưa Phân Công",
      role: "branch_manager",
    });
    unassignedManagerToken = generateToken(unassignedManager._id);

    customer = await createUser({
      name: "Khách Hàng Thường",
      role: "user",
    });
    customerToken = generateToken(customer._id);

    merchant = await Merchant.create({
      name: "Phở Hà Nội Phố",
      slug: `pho-ha-noi-${Date.now()}-${Math.random()}`,
      ownerUserId: owner._id,
      status: "active",
      type: "brand",
    });

    branch1 = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh Quận 1",
      code: "Q1",
      status: "active",
      isOpen: true,
      droneDeliveryEnabled: false,
      managerUserIds: [manager1._id],
      address: { text: "123 Lê Lợi, Q1", lat: 10.778, lng: 106.699 },
    });

    branch2 = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh Quận 3",
      code: "Q3",
      status: "active",
      isOpen: true,
      droneDeliveryEnabled: false,
      managerUserIds: [manager2._id],
      address: { text: "456 Võ Văn Tần, Q3", lat: 10.781, lng: 106.691 },
    });
  });

  describe("GET /api/user/me multi-branch enrichment", () => {
    it("enriches merchant_owner with merchantId and all managedBranchIds", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe("merchant_owner");
      expect(res.body.data.merchantId).toBe(merchant._id.toString());
      expect(res.body.data.managedBranchIds).toHaveLength(2);
      expect(res.body.data.managedBranchIds).toContain(branch1._id.toString());
      expect(res.body.data.managedBranchIds).toContain(branch2._id.toString());
    });

    it("enriches branch_manager with merchantId, branchId, and only assigned branch in managedBranchIds", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${manager1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe("branch_manager");
      expect(res.body.data.merchantId).toBe(merchant._id.toString());
      expect(res.body.data.branchId).toBe(branch1._id.toString());
      expect(res.body.data.restaurantId).toBe(branch1._id.toString());
      expect(res.body.data.managedBranchIds).toHaveLength(1);
      expect(res.body.data.managedBranchIds).toContain(branch1._id.toString());
      expect(res.body.data.managedBranchIds).not.toContain(branch2._id.toString());
    });

    it("does not attach merchant identifiers to regular customer", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe("user");
      expect(res.body.data.merchantId).toBeUndefined();
      expect(res.body.data.managedBranchIds).toBeUndefined();
    });

    it("enriches legacy restaurant_owner on getMe after auto-ensuring merchant", async () => {
      const { owner: legacyOwner } = await createRestaurantOwner();
      const legacyToken = generateToken(legacyOwner._id);

      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${legacyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchantId).toBeDefined();
      expect(res.body.data.managedBranchIds).toHaveLength(1);
    });
  });

  describe("GET /api/merchant/me", () => {
    it("returns merchant profile and all branches for merchant_owner", async () => {
      const res = await request(app)
        .get("/api/merchant/me")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchant._id).toBe(merchant._id.toString());
      expect(res.body.data.merchant.name).toBe("Phở Hà Nội Phố");
      expect(res.body.data.branches).toHaveLength(2);
    });

    it("returns brand merchant and only assigned branches for branch_manager", async () => {
      const res = await request(app)
        .get("/api/merchant/me")
        .set("Authorization", `Bearer ${manager1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchant._id).toBe(merchant._id.toString());
      expect(res.body.data.branches).toHaveLength(1);
      expect(res.body.data.branches[0]._id).toBe(branch1._id.toString());
      expect(res.body.data.branches[0].code).toBe("Q1");
    });

    it("maps legacy restaurant_owner and returns merchant and branch", async () => {
      const { owner: legacyOwner, restaurant: legacyRestaurant } = await createRestaurantOwner();
      const legacyToken = generateToken(legacyOwner._id);

      const res = await request(app)
        .get("/api/merchant/me")
        .set("Authorization", `Bearer ${legacyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchant).toBeDefined();
      expect(res.body.data.branches).toHaveLength(1);
      expect(res.body.data.branches[0].code).toBe("MAIN");
    });

    it("returns 404 for branch_manager with no assigned branches", async () => {
      const res = await request(app)
        .get("/api/merchant/me")
        .set("Authorization", `Bearer ${unassignedManagerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Bạn chưa được phân công quản lý chi nhánh nào");
    });

    it("returns 403 Forbidden for regular customer", async () => {
      const res = await request(app)
        .get("/api/merchant/me")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/branch/my-branches and GET /api/branch/managed", () => {
    it("returns all branches with populated merchant details for merchant_owner", async () => {
      for (const endpoint of ["/api/branch/my-branches", "/api/branch/managed"]) {
        const res = await request(app)
          .get(endpoint)
          .set("Authorization", `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(2);

        const firstBranch = res.body.data[0];
        expect(firstBranch.merchantId).toBeDefined();
        expect(firstBranch.merchantId.name).toBe("Phở Hà Nội Phố");
        expect(firstBranch.merchantId.slug).toBe(merchant.slug);
        expect(firstBranch.merchantId.type).toBe("brand");
      }
    });

    it("returns only assigned branch with populated merchant details for branch_manager", async () => {
      for (const endpoint of ["/api/branch/my-branches", "/api/branch/managed"]) {
        const res = await request(app)
          .get(endpoint)
          .set("Authorization", `Bearer ${manager1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]._id).toBe(branch1._id.toString());
        expect(res.body.data[0].merchantId.name).toBe("Phở Hà Nội Phố");
      }
    });

    it("returns empty array for regular user", async () => {
      const res = await request(app)
        .get("/api/branch/my-branches")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("rejects unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/branch/my-branches");
      expect(res.status).toBe(401);
    });
  });

  describe("Branch manager operational permissions", () => {
    it("allows branch_manager to toggle open-state on assigned branch", async () => {
      const res = await request(app)
        .patch(`/api/branch/${branch1._id}/open-state`)
        .set("Authorization", `Bearer ${manager1Token}`)
        .send({ isOpen: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isOpen).toBe(false);

      const updated = await Branch.findById(branch1._id);
      expect(updated.isOpen).toBe(false);
    });

    it("blocks branch_manager from toggling open-state on another branch with 403", async () => {
      const res = await request(app)
        .patch(`/api/branch/${branch2._id}/open-state`)
        .set("Authorization", `Bearer ${manager1Token}`)
        .send({ isOpen: false });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Bạn không có quyền quản lý chi nhánh này");

      const untouched = await Branch.findById(branch2._id);
      expect(untouched.isOpen).toBe(true);
    });

    it("blocks branch_manager from creating new branch with 403 (owner-only)", async () => {
      const res = await request(app)
        .post("/api/branch")
        .set("Authorization", `Bearer ${manager1Token}`)
        .send({
          merchantId: merchant._id.toString(),
          name: "Chi nhánh trái phép",
          code: "HACK",
          address: "789 Cách Mạng Tháng 8",
        });

      expect(res.status).toBe(403);
    });

    it("blocks branch_manager from assigning managers with 403 (owner-only)", async () => {
      const res = await request(app)
        .post(`/api/branch/${branch1._id}/managers`)
        .set("Authorization", `Bearer ${manager1Token}`)
        .send({
          userIds: [unassignedManager._id.toString()],
        });

      expect(res.status).toBe(403);
    });

    it("allows merchant_owner to toggle open-state on any of their branches", async () => {
      const res = await request(app)
        .patch(`/api/branch/${branch2._id}/open-state`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ isOpen: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isOpen).toBe(false);
    });
  });

  describe("1 Branch - 1 Manager Enforcement", () => {
    it("assigns 1 manager to a branch and promotes user to branch_manager", async () => {
      const candidateUser = await createUser({
        name: "Ứng Viên Quản Lý",
        role: "user",
      });

      const res = await request(app)
        .post(`/api/branch/${branch2._id}/managers`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ userIds: [candidateUser._id.toString()] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedBranch = await Branch.findById(branch2._id);
      expect(updatedBranch.managerUserIds).toHaveLength(1);
      expect(updatedBranch.managerUserIds[0].toString()).toBe(candidateUser._id.toString());

      const promotedUser = await User.findById(candidateUser._id);
      expect(promotedUser.role).toBe("branch_manager");
    });

    it("rejects assigning more than 1 manager to a branch with 400", async () => {
      const userA = await createUser({ role: "user" });
      const userB = await createUser({ role: "user" });

      const res = await request(app)
        .post(`/api/branch/${branch1._id}/managers`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ userIds: [userA._id.toString(), userB._id.toString()] });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Mỗi chi nhánh chỉ được có tối đa 1 quản lý");
    });

    it("rejects assigning a manager who is already managing another branch with 409", async () => {
      // manager1 is already managing branch1
      const res = await request(app)
        .post(`/api/branch/${branch2._id}/managers`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ userIds: [manager1._id.toString()] });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("Một quản lý chỉ được quản lý 1 chi nhánh");

      // Verify branch2 was not modified
      const branch2After = await Branch.findById(branch2._id);
      expect(branch2After.managerUserIds.map((id) => id.toString())).toContain(manager2._id.toString());
      expect(branch2After.managerUserIds.map((id) => id.toString())).not.toContain(manager1._id.toString());
    });

    it("unassigns manager and demotes role back to user", async () => {
      const res = await request(app)
        .post(`/api/branch/${branch1._id}/managers`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ userIds: [] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedBranch = await Branch.findById(branch1._id);
      expect(updatedBranch.managerUserIds).toHaveLength(0);

      const demotedUser = await User.findById(manager1._id);
      expect(demotedUser.role).toBe("user");
    });
  });
});
