import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../app.js";
import { Branch, Merchant, User } from "../../models/index.cjs";
import { createAdmin, createUser, generateToken } from "../helpers.js";

describe("Merchant & Branch Integration API", () => {
  let admin, adminToken;
  let ownerUser, ownerToken;
  let otherUser, otherToken;
  let managerUser, managerToken;

  beforeEach(async () => {
    admin = await createAdmin();
    adminToken = generateToken(admin._id);

    ownerUser = await createUser({
      name: "Chủ Quán Test",
      email: `owner-${Date.now()}-${Math.random()}@test.com`,
      role: "user",
    });
    ownerToken = generateToken(ownerUser._id);

    otherUser = await createUser({
      name: "Người Dùng Khác",
      email: `other-${Date.now()}-${Math.random()}@test.com`,
      role: "user",
    });
    otherToken = generateToken(otherUser._id);

    managerUser = await createUser({
      name: "Quản Lý Chi Nhánh",
      email: `manager-${Date.now()}-${Math.random()}@test.com`,
      role: "branch_manager",
    });
    managerToken = generateToken(managerUser._id);

    await Branch.createIndexes();
    await Merchant.createIndexes();
  });

  describe("POST /api/merchant/register", () => {
    it("registers a new merchant and MAIN branch with valid token", async () => {
      const res = await request(app)
        .post("/api/merchant/register")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Phở Gia Truyền 1980",
          address: {
            text: "123 Hai Bà Trưng, Q1, TP HCM",
            lat: 10.778,
            lng: 106.699,
          },
          phone: "0901234567",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchant).toBeDefined();
      expect(res.body.data.merchant.slug).toBe("pho-gia-truyen-1980");
      expect(res.body.data.merchant.status).toBe("pending");
      expect(res.body.data.branch.code).toBe("MAIN");
      expect(res.body.data.branch.name).toBe("Chi nhánh chính");

      const userAfter = await User.findById(ownerUser._id);
      expect(userAfter.role).toBe("merchant_owner");
    });

    it("rejects without authentication token with 401", async () => {
      const res = await request(app)
        .post("/api/merchant/register")
        .send({
          name: "Quán Không Token",
          address: "Hà Nội",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects if user already registered a merchant with 409", async () => {
      await request(app)
        .post("/api/merchant/register")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Quán Lần Đầu",
          address: "123 Lê Lợi",
        });

      const res = await request(app)
        .post("/api/merchant/register")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Quán Lần Hai",
          address: "456 Nguyễn Huệ",
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("Bạn đã sở hữu một merchant");
    });

    it("rejects invalid input via Joi validation with 400", async () => {
      const res = await request(app)
        .post("/api/merchant/register")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "",
          address: "12", // too short
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Admin approval & suspension", () => {
    it("approves pending merchant and activates MAIN branch only for admin", async () => {
      const regRes = await request(app)
        .post("/api/merchant/register")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Trà Sữa Đô Đô",
          address: "10 Nguyễn Đình Chiểu",
        });

      const merchantId = regRes.body.data.merchant._id;

      // Non-admin cannot approve
      const forbidRes = await request(app)
        .post(`/api/merchant/${merchantId}/approve`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(forbidRes.status).toBe(403);

      // Admin approves
      const approveRes = await request(app)
        .post(`/api/merchant/${merchantId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe("active");

      const branch = await Branch.findOne({ merchantId, code: "MAIN" });
      expect(branch.status).toBe("active");
    });

    it("suspends active merchant and closes all its branches, and does not auto-open on re-approval", async () => {
      const regRes = await request(app)
        .post("/api/merchant/register")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Bánh Mì Kẹp Thịt",
          address: "50 Phạm Ngũ Lão",
        });

      const merchantId = regRes.body.data.merchant._id;
      const branchId = regRes.body.data.branch._id;

      // Approve first
      await request(app)
        .post(`/api/merchant/${merchantId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      // Owner opens the branch
      await request(app)
        .patch(`/api/branch/${branchId}/open-state`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ isOpen: true });

      let branch = await Branch.findById(branchId);
      expect(branch.isOpen).toBe(true);

      // Admin suspends
      const suspendRes = await request(app)
        .post(`/api/merchant/${merchantId}/suspend`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Vi phạm hợp đồng" });

      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.data.status).toBe("suspended");

      branch = await Branch.findById(branchId);
      expect(branch.isOpen).toBe(false);

      // Re-approve (un-suspend)
      await request(app)
        .post(`/api/merchant/${merchantId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      // Branch must NOT be auto-opened
      branch = await Branch.findById(branchId);
      expect(branch.isOpen).toBe(false);
    });
  });

  describe("Branch management & access control", () => {
    let merchantId, mainBranchId;

    beforeEach(async () => {
      const reg = await request(app)
        .post("/api/merchant/register")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Chuỗi Cơm Tấm Đêm",
          address: { text: "Quận 1", lat: 10.77, lng: 106.70 },
        });

      merchantId = reg.body.data.merchant._id;
      mainBranchId = reg.body.data.branch._id;

      // Approve merchant
      await request(app)
        .post(`/api/merchant/${merchantId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);
    });

    it("allows merchant owner to create a new branch and blocks non-owner", async () => {
      // Non-owner cannot create branch
      const forbidRes = await request(app)
        .post("/api/branch")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({
          merchantId,
          name: "Chi nhánh Quận 3",
          code: "Q3",
          address: "10 Võ Văn Tần, Q3",
        });
      expect(forbidRes.status).toBe(403);

      // Branch manager cannot create branch
      const managerForbidRes = await request(app)
        .post("/api/branch")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          merchantId,
          name: "Chi nhánh Quận 3",
          code: "Q3",
          address: "10 Võ Văn Tần, Q3",
        });
      expect(managerForbidRes.status).toBe(403);

      // Owner can create branch
      const createRes = await request(app)
        .post("/api/branch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          merchantId,
          name: "Chi nhánh Quận 3",
          code: "Q3",
          address: { text: "10 Võ Văn Tần, Q3", lat: 10.78, lng: 106.69 },
          deliveryRadiusKm: 5,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.code).toBe("Q3");

      const merchant = await Merchant.findById(merchantId);
      expect(merchant.branchCount).toBe(2);
      expect(merchant.type).toBe("brand");
    });

    it("allows owner and assigned manager to update branch and change open state", async () => {
      // Assign managerUser to main branch
      await request(app)
        .post(`/api/branch/${mainBranchId}/managers`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ userIds: [managerUser._id.toString()] });

      // Manager updates phone
      const updateRes = await request(app)
        .put(`/api/branch/${mainBranchId}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ phone: "0988776655" });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.phone).toBe("0988776655");

      // Manager toggles open-state
      const openRes = await request(app)
        .patch(`/api/branch/${mainBranchId}/open-state`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ isOpen: true });

      expect(openRes.status).toBe(200);
      expect(openRes.body.data.isOpen).toBe(true);

      // Other user is forbidden
      const otherRes = await request(app)
        .patch(`/api/branch/${mainBranchId}/open-state`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ isOpen: false });

      expect(otherRes.status).toBe(403);
    });

    it("blocks deleting the last branch of a merchant with 400", async () => {
      const delRes = await request(app)
        .delete(`/api/branch/${mainBranchId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(delRes.status).toBe(400);
      expect(delRes.body.message).toContain("Không thể xóa chi nhánh duy nhất");
    });

    it("allows owner to assign branch managers and blocks non-owner with 403", async () => {
      const forbidRes = await request(app)
        .post(`/api/branch/${mainBranchId}/managers`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ userIds: [managerUser._id.toString()] });

      expect(forbidRes.status).toBe(403);

      const okRes = await request(app)
        .post(`/api/branch/${mainBranchId}/managers`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ userIds: [managerUser._id.toString()] });

      expect(okRes.status).toBe(200);
      expect(okRes.body.data.managerUserIds).toContain(managerUser._id.toString());
    });
  });

  describe("Admin merchant list search and pagination", () => {
    it("returns paginated merchants with owner name/email only", async () => {
      const owners = [];
      for (let index = 0; index < 9; index += 1) {
        const owner = await createUser({
          name: `Owner ${index}`,
          email: `merchant-page-${index}@test.com`,
          role: "merchant_owner",
        });
        owners.push(owner);
        await Merchant.create({
          name: `Merchant ${String(index).padStart(2, "0")}`,
          slug: `merchant-${index}`,
          ownerUserId: owner._id,
          status: index % 2 === 0 ? "active" : "pending",
          type: index > 4 ? "brand" : "individual",
          branchCount: index > 4 ? 2 : 1,
        });
      }

      const response = await request(app)
        .get("/api/merchant/list")
        .query({ page: 1, limit: 5 })
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(5);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
        total: 9,
        totalPages: 2,
      });
      expect(response.body.data[0].ownerUserId).toMatchObject({
        name: expect.any(String),
        email: expect.any(String),
      });
      expect(response.body.data[0].ownerUserId.password).toBeUndefined();
      expect(response.body.data[0].ownerUserId.refreshToken).toBeUndefined();

      const pageTwo = await request(app)
        .get("/api/merchant/list")
        .query({ page: 2, limit: 5 })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(pageTwo.status).toBe(200);
      expect(pageTwo.body.data).toHaveLength(4);
      expect(pageTwo.body.data.map((row) => row._id)).not.toEqual(
        response.body.data.map((row) => row._id)
      );
    });

    it("searches by name, slug, and owner email before pagination", async () => {
      const alphaOwner = await createUser({
        name: "Alpha Owner",
        email: "owner-search-alpha@test.com",
        role: "merchant_owner",
      });
      const betaOwner = await createUser({
        name: "Beta Owner",
        email: "owner-search-beta@test.com",
        role: "merchant_owner",
      });
      await Merchant.create({
        name: "ABC Kitchen",
        slug: "abc-kitchen",
        ownerUserId: alphaOwner._id,
        status: "active",
        type: "individual",
      });
      await Merchant.create({
        name: "Bếp Việt",
        slug: "viet-kitchen-special",
        ownerUserId: betaOwner._id,
        status: "active",
        type: "brand",
      });

      const byName = await request(app)
        .get("/api/merchant/list")
        .query({ q: "abc", page: 1, limit: 5 })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(byName.status).toBe(200);
      expect(byName.body.data).toHaveLength(1);
      expect(byName.body.data[0].name).toBe("ABC Kitchen");

      const bySlug = await request(app)
        .get("/api/merchant/list")
        .query({ q: "viet-kitchen", page: 1, limit: 5 })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(bySlug.status).toBe(200);
      expect(bySlug.body.data).toHaveLength(1);
      expect(bySlug.body.data[0].slug).toBe("viet-kitchen-special");

      const byOwnerEmail = await request(app)
        .get("/api/merchant/list")
        .query({ q: "owner-search-beta", page: 1, limit: 5 })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(byOwnerEmail.status).toBe(200);
      expect(byOwnerEmail.body.data).toHaveLength(1);
      expect(byOwnerEmail.body.data[0].ownerUserId.email).toBe(
        "owner-search-beta@test.com"
      );
    });

    it("escapes regex special characters in q", async () => {
      const owner = await createUser({
        name: "Literal Owner",
        email: "literal-regex@test.com",
        role: "merchant_owner",
      });
      await Merchant.create({
        name: "Literal .* Merchant",
        slug: "literal-dot-star",
        ownerUserId: owner._id,
        status: "active",
      });
      await Merchant.create({
        name: "Unrelated Merchant",
        slug: "unrelated",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
      });

      const dotStar = await request(app)
        .get("/api/merchant/list")
        .query({ q: ".*" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(dotStar.status).toBe(200);
      expect(dotStar.body.data).toHaveLength(1);
      expect(dotStar.body.data[0].name).toBe("Literal .* Merchant");

      const unmatchedParenthesis = await request(app)
        .get("/api/merchant/list")
        .query({ q: "(" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(unmatchedParenthesis.status).toBe(200);
      expect(unmatchedParenthesis.body.data).toEqual([]);
    });

    it("sorts merchants by attributes like name, branchCount, owner, and status", async () => {
      const ownerZ = await createUser({
        name: "Zach Owner",
        email: "zach@test.com",
        role: "merchant_owner",
      });
      const ownerA = await createUser({
        name: "Adam Owner",
        email: "adam@test.com",
        role: "merchant_owner",
      });

      await Merchant.create({
        name: "Zeta Merchant",
        slug: "zeta-merchant",
        ownerUserId: ownerZ._id,
        status: "active",
        type: "individual",
        branchCount: 1,
      });
      await Merchant.create({
        name: "Alpha Merchant",
        slug: "alpha-merchant",
        ownerUserId: ownerA._id,
        status: "pending",
        type: "brand",
        branchCount: 5,
      });

      const sortNameAsc = await request(app)
        .get("/api/merchant/list")
        .query({ sortBy: "name", order: "asc" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(sortNameAsc.status).toBe(200);
      const names = sortNameAsc.body.data.map((m) => m.name);
      expect(names.indexOf("Alpha Merchant")).toBeLessThan(names.indexOf("Zeta Merchant"));

      const sortNameDesc = await request(app)
        .get("/api/merchant/list")
        .query({ sortBy: "name", order: "desc" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(sortNameDesc.status).toBe(200);
      const descNames = sortNameDesc.body.data.map((m) => m.name);
      expect(descNames.indexOf("Zeta Merchant")).toBeLessThan(descNames.indexOf("Alpha Merchant"));

      const sortBranchCountDesc = await request(app)
        .get("/api/merchant/list")
        .query({ sortBy: "branchCount", order: "desc" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(sortBranchCountDesc.status).toBe(200);
      expect(sortBranchCountDesc.body.data[0].branchCount).toBeGreaterThanOrEqual(
        sortBranchCountDesc.body.data[sortBranchCountDesc.body.data.length - 1].branchCount
      );

      const sortOwnerAsc = await request(app)
        .get("/api/merchant/list")
        .query({ sortBy: "owner", order: "asc" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(sortOwnerAsc.status).toBe(200);
      const ownerNames = sortOwnerAsc.body.data.map((m) => m.ownerUserId?.name);
      expect(ownerNames.indexOf("Adam Owner")).toBeLessThan(ownerNames.indexOf("Zach Owner"));
    });
  });

  describe("Admin branch list search, filters, and pagination", () => {
    it("lists all branches with safe merchant projection and server pagination", async () => {
      const merchants = [];
      for (let index = 0; index < 3; index += 1) {
        const owner = await createUser({
          name: `Branch Owner ${index}`,
          email: `branch-page-${index}@test.com`,
          role: "merchant_owner",
        });
        const merchant = await Merchant.create({
          name: `Merchant Branch ${index}`,
          slug: `merchant-branch-${index}`,
          ownerUserId: owner._id,
          status: "active",
          type: "individual",
        });
        merchants.push(merchant);
        for (let branchIndex = 0; branchIndex < 3; branchIndex += 1) {
          await Branch.create({
            merchantId: merchant._id,
            name: `Branch ${index}-${branchIndex}`,
            code: `B${index}${branchIndex}`,
            status: branchIndex === 0 ? "pending" : "active",
            isOpen: true,
            droneDeliveryEnabled: branchIndex % 2 === 0,
            address: { text: `Address ${index}-${branchIndex}` },
          });
        }
      }

      const response = await request(app)
        .get("/api/branch/list")
        .query({ page: 1, limit: 5 })
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(5);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
        total: 9,
        totalPages: 2,
      });
      expect(response.body.data[0].merchantId).toMatchObject({
        name: expect.any(String),
        slug: expect.any(String),
        type: expect.any(String),
      });
      expect(response.body.data[0].merchantId.ownerUserId).toBeUndefined();
      expect(response.body.data[0].merchantId.revenueShare).toBeUndefined();
    });

    it("filters branches by merchant, status, and query-string booleans", async () => {
      const merchantA = await Merchant.create({
        name: "Merch Filter A",
        slug: "merch-filter-a",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
      });
      const merchantB = await Merchant.create({
        name: "Merch Filter B",
        slug: "merch-filter-b",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
      });
      await Branch.create({
        merchantId: merchantA._id,
        name: "Drone enabled branch",
        code: "MAIN",
        status: "active",
        droneDeliveryEnabled: true,
      });
      await Branch.create({
        merchantId: merchantA._id,
        name: "Locked branch",
        code: "LOCK",
        status: "locked",
        droneDeliveryEnabled: false,
      });
      await Branch.create({
        merchantId: merchantB._id,
        name: "Other merchant branch",
        code: "OTHER",
        status: "active",
        droneDeliveryEnabled: false,
      });

      const byMerchant = await request(app)
        .get("/api/branch/list")
        .query({ merchantId: merchantA._id.toString() })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(byMerchant.status).toBe(200);
      expect(byMerchant.body.data).toHaveLength(2);

      const activeDrone = await request(app)
        .get("/api/branch/list")
        .query({ status: "active", droneDeliveryEnabled: "true" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(activeDrone.status).toBe(200);
      expect(activeDrone.body.data).toHaveLength(1);
      expect(activeDrone.body.data[0].name).toBe("Drone enabled branch");

      const disabled = await request(app)
        .get("/api/branch/list")
        .query({ droneDeliveryEnabled: "false" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(disabled.status).toBe(200);
      expect(disabled.body.data).toHaveLength(2);
    });

    it("searches branch name/code and merchant name safely", async () => {
      const merchant = await Merchant.create({
        name: "Alpha Operations",
        slug: "alpha-operations",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
      });
      await Branch.create({
        merchantId: merchant._id,
        name: "Central MAIN Point",
        code: "MAIN",
        status: "active",
      });
      await Branch.create({
        merchantId: new mongoose.Types.ObjectId(),
        name: "Literal .* Branch",
        code: "REGEX",
        status: "active",
      });

      const byCode = await request(app)
        .get("/api/branch/list")
        .query({ q: "MAIN" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(byCode.status).toBe(200);
      expect(byCode.body.data).toHaveLength(1);
      expect(byCode.body.data[0].code).toBe("MAIN");

      const byMerchant = await request(app)
        .get("/api/branch/list")
        .query({ q: "alpha operations" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(byMerchant.status).toBe(200);
      expect(byMerchant.body.data).toHaveLength(1);
      expect(byMerchant.body.data[0].merchantId.name).toBe("Alpha Operations");

      const literal = await request(app)
        .get("/api/branch/list")
        .query({ q: ".*" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(literal.status).toBe(200);
      expect(literal.body.data).toHaveLength(1);
      expect(literal.body.data[0].name).toBe("Literal .* Branch");

      const parenthesis = await request(app)
        .get("/api/branch/list")
        .query({ q: "(" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(parenthesis.status).toBe(200);
      expect(parenthesis.body.data).toEqual([]);
    });

    it("sorts branches by attributes like name and merchant", async () => {
      const merchA = await Merchant.create({
        name: "AAA Store",
        slug: "aaa-store",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
      });
      const merchZ = await Merchant.create({
        name: "ZZZ Store",
        slug: "zzz-store",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
      });
      await Branch.create({
        merchantId: merchZ._id,
        name: "ZZZ Branch",
        code: "Z01",
        status: "active",
        droneDeliveryEnabled: false,
      });
      await Branch.create({
        merchantId: merchA._id,
        name: "AAA Branch",
        code: "A01",
        status: "active",
        droneDeliveryEnabled: true,
      });

      const sortNameAsc = await request(app)
        .get("/api/branch/list")
        .query({ sortBy: "name", order: "asc" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(sortNameAsc.status).toBe(200);
      const branchNames = sortNameAsc.body.data.map((b) => b.name);
      expect(branchNames.indexOf("AAA Branch")).toBeLessThan(branchNames.indexOf("ZZZ Branch"));

      const sortMerchantAsc = await request(app)
        .get("/api/branch/list")
        .query({ sortBy: "merchant", order: "asc" })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(sortMerchantAsc.status).toBe(200);
      const merchantNames = sortMerchantAsc.body.data.map((b) => b.merchantId?.name);
      expect(merchantNames.indexOf("AAA Store")).toBeLessThan(merchantNames.indexOf("ZZZ Store"));
    });
  });

  describe("Public queries: GET /api/branch/nearby & GET /api/merchant/:slug/public", () => {
    it("returns nearest branches grouped by merchant with valid distance sorting", async () => {
      const reg = await request(app)
        .post("/api/merchant/register")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Lẩu Dê Tươi",
          address: { text: "1 Nguyễn Huệ, Q1", lat: 10.772, lng: 106.701 },
        });

      const merchantId = reg.body.data.merchant._id;
      const mainBranchId = reg.body.data.branch._id;

      await request(app)
        .post(`/api/merchant/${merchantId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      await request(app)
        .patch(`/api/branch/${mainBranchId}/open-state`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ isOpen: true });

      const nearbyRes = await request(app)
        .get("/api/branch/nearby")
        .query({ lat: 10.770, lng: 106.700, radius: 10 });

      expect(nearbyRes.status).toBe(200);
      expect(nearbyRes.body.success).toBe(true);
      expect(nearbyRes.body.data.length).toBeGreaterThanOrEqual(1);
      const entry = nearbyRes.body.data.find(
        (item) => item.merchant._id.toString() === merchantId.toString()
      );
      expect(entry).toBeDefined();
      expect(entry.nearestBranch._id.toString()).toBe(mainBranchId.toString());
      expect(entry.distance).toBeGreaterThan(0);
    });

    it("hides sensitive fields on public slug query and returns 404 for inactive", async () => {
      const reg = await request(app)
        .post("/api/merchant/register")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Cà Phê Muối",
          address: "10 Trần Phú",
        });

      const slug = reg.body.data.merchant.slug;

      // Pending merchant -> 404
      const pendingRes = await request(app).get(`/api/merchant/${slug}/public`);
      expect(pendingRes.status).toBe(404);

      // Approve merchant
      await request(app)
        .post(`/api/merchant/${reg.body.data.merchant._id}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      // Active merchant -> 200, sensitive fields hidden
      const publicRes = await request(app).get(`/api/merchant/${slug}/public`);
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.data.merchant.name).toBe("Cà Phê Muối");
      expect(publicRes.body.data.merchant.ownerUserId).toBeUndefined();
      expect(publicRes.body.data.merchant.revenueShare).toBeUndefined();
    });
  });
});
