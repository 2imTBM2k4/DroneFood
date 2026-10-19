import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../app.js";
import { Branch, Merchant, User, Food, Restaurant } from "../../models/index.cjs";
import { createAdmin, createRestaurantOwner, createUser, generateToken } from "../helpers.js";

describe("Brand Upgrade Application Workflow & Branch Food Availability Integration", () => {
  let admin, adminToken;
  let ownerUser, ownerToken;
  let branchManager, managerToken;
  let otherManager, otherManagerToken;
  let customerUser, customerToken;
  let merchant, mainBranch, branch2, testFood;

  beforeEach(async () => {
    admin = await createAdmin();
    adminToken = generateToken(admin._id);

    ownerUser = await createUser({
      name: "Chủ Quán Bún Bò",
      role: "restaurant_owner",
      email: `owner-${Date.now()}@test.com`,
    });
    ownerToken = generateToken(ownerUser._id);

    branchManager = await createUser({
      name: "Quản Lý Chi Nhánh 1",
      role: "branch_manager",
      email: `manager1-${Date.now()}@test.com`,
    });
    managerToken = generateToken(branchManager._id);

    otherManager = await createUser({
      name: "Quản Lý Chi Nhánh Khác",
      role: "branch_manager",
      email: `manager2-${Date.now()}@test.com`,
    });
    otherManagerToken = generateToken(otherManager._id);

    customerUser = await createUser({
      name: "Khách Ăn Hàng",
      role: "user",
      email: `customer-${Date.now()}@test.com`,
    });
    customerToken = generateToken(customerUser._id);

    // Khởi tạo merchant cá nhân (individual)
    merchant = await Merchant.create({
      type: "individual",
      name: "Bún Bò Huế O Mai",
      slug: `bun-bo-o-mai-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      ownerUserId: ownerUser._id,
      status: "active",
      branchCount: 1,
    });

    mainBranch = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh Gốc Quận 1",
      code: "MAIN",
      address: { text: "123 Lê Lợi, Q1", lat: 10.77, lng: 106.69 },
      phone: "0901234567",
      isOpen: true,
      status: "active",
      managerUserIds: [branchManager._id],
    });

    branch2 = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh Quận 3",
      code: "BR-Q3",
      address: { text: "456 CMT8, Q3", lat: 10.78, lng: 106.68 },
      phone: "0909999888",
      isOpen: true,
      status: "active",
      managerUserIds: [otherManager._id],
    });

    testFood = await Food.create({
      name: "Bún Bò Đặc Biệt",
      description: "Đầy đủ thịt bò nạm, gân, chả cua",
      price: 65000,
      image: "https://example.com/food.jpg",
      category: "Bún",
      merchantId: merchant._id,
      restaurantId: merchant._id,
      isAvailable: true,
      unavailableBranchIds: [],
    });
  });

  describe("Brand Upgrade Application Submission & Processing", () => {
    it("cho phép chủ quán cá nhân nộp hồ sơ nâng cấp chuỗi thương hiệu", async () => {
      const payload = {
        brandName: "Chuỗi Bún Bò Huế O Mai Toàn Quốc",
        taxCode: "0102030405",
        representativeName: "Nguyễn Văn Mai",
        phone: "0912345678",
        licenseImages: ["https://example.com/license-1.jpg"],
        notes: "Muốn mở rộng thêm 5 chi nhánh tại TP.HCM",
      };

      const res = await request(app)
        .post("/api/merchant/brand-application")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("pending");
      expect(res.body.data.brandName).toBe(payload.brandName);
      expect(res.body.data.taxCode).toBe(payload.taxCode);
    });

    it("chặn nộp hồ sơ khi đã có hồ sơ đang chờ duyệt (pending)", async () => {
      merchant.brandApplication = {
        status: "pending",
        brandName: "Chuỗi Đang Chờ",
        representativeName: "Nguyễn Văn A",
        phone: "0912345678",
      };
      await merchant.save();

      const res = await request(app)
        .post("/api/merchant/brand-application")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          brandName: "Nộp Lại Đè Lên",
          representativeName: "Nguyễn Văn A",
          phone: "0912345678",
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("đang chờ Admin xét duyệt");
    });

    it("cho phép chủ quán xem trạng thái hồ sơ của mình", async () => {
      merchant.brandApplication = {
        status: "pending",
        brandName: "Chuỗi Bún Bò",
        representativeName: "Nguyễn Văn Mai",
        phone: "0912345678",
        submittedAt: new Date(),
      };
      await merchant.save();

      const res = await request(app)
        .get("/api/merchant/brand-application")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.brandApplication.status).toBe("pending");
      expect(res.body.data.brandApplication.brandName).toBe("Chuỗi Bún Bò");
    });

    it("Admin có thể xem danh sách hồ sơ nâng cấp chuỗi", async () => {
      merchant.brandApplication = {
        status: "pending",
        brandName: "Chuỗi Chờ Duyệt",
        representativeName: "Nguyễn Văn B",
        phone: "0987654321",
        submittedAt: new Date(),
      };
      await merchant.save();

      const res = await request(app)
        .get("/api/merchant/brand-applications?status=pending")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("Admin từ chối hồ sơ kèm lý do; chủ quán nhận được lý do từ chối", async () => {
      merchant.brandApplication = {
        status: "pending",
        brandName: "Chuỗi Thiếu Giấy Phép",
        representativeName: "Nguyễn Văn C",
        phone: "0987654321",
        submittedAt: new Date(),
      };
      await merchant.save();

      const res = await request(app)
        .post(`/api/merchant/${merchant._id}/decide-brand-application`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          decision: "rejected",
          reason: "Giấy phép kinh doanh bị mờ, vui lòng chụp lại rõ nét",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.brandApplication.status).toBe("rejected");
      expect(res.body.data.brandApplication.rejectReason).toContain("Giấy phép kinh doanh bị mờ");

      // Merchant vẫn giữ type là individual
      const updatedMerchant = await Merchant.findById(merchant._id);
      expect(updatedMerchant.type).toBe("individual");

      // User vẫn giữ role restaurant_owner
      const user = await User.findById(ownerUser._id);
      expect(user.role).toBe("restaurant_owner");
    });

    it("Admin phê duyệt hồ sơ: merchant lên brand, user lên merchant_owner", async () => {
      merchant.brandApplication = {
        status: "pending",
        brandName: "Bún Bò O Mai Hệ Thống Toàn Quốc",
        taxCode: "0312345678",
        representativeName: "Nguyễn Văn Mai",
        phone: "0912345678",
        submittedAt: new Date(),
      };
      await merchant.save();

      const res = await request(app)
        .post(`/api/merchant/${merchant._id}/decide-brand-application`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          decision: "approved",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.brandApplication.status).toBe("approved");

      // Kiểm tra database sau phê duyệt
      const updatedMerchant = await Merchant.findById(merchant._id);
      expect(updatedMerchant.type).toBe("brand");
      expect(updatedMerchant.name).toBe("Bún Bò O Mai Hệ Thống Toàn Quốc");

      // Kiểm tra user được nâng quyền lên merchant_owner
      const updatedUser = await User.findById(ownerUser._id);
      expect(updatedUser.role).toBe("merchant_owner");
    });
  });

  describe("Branch Food Availability Controls", () => {
    it("cho phép branch manager tắt món tại chi nhánh của mình", async () => {
      const res = await request(app)
        .patch(`/api/food/${testFood._id}/branch-availability`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          branchId: mainBranch._id.toString(),
          isAvailable: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedFood = await Food.findById(testFood._id);
      expect(
        updatedFood.unavailableBranchIds.some(
          (id) => id.toString() === mainBranch._id.toString()
        )
      ).toBe(true);
      // Menu gốc vẫn giữ isAvailable = true
      expect(updatedFood.isAvailable).toBe(true);
    });

    it("chặn branch manager can thiệp tắt món của chi nhánh khác", async () => {
      const res = await request(app)
        .patch(`/api/food/${testFood._id}/branch-availability`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          branchId: branch2._id.toString(),
          isAvailable: false,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("không có quyền");
    });

    it("cho phép branch manager bật lại món đã tắt tại chi nhánh của mình", async () => {
      testFood.unavailableBranchIds = [mainBranch._id];
      await testFood.save();

      const res = await request(app)
        .patch(`/api/food/${testFood._id}/branch-availability`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          branchId: mainBranch._id.toString(),
          isAvailable: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedFood = await Food.findById(testFood._id);
      expect(
        updatedFood.unavailableBranchIds.some(
          (id) => id.toString() === mainBranch._id.toString()
        )
      ).toBe(false);
    });

    it("chặn khách đặt món khi món đã tạm hết tại chi nhánh đó", async () => {
      // Tắt món tại mainBranch
      testFood.unavailableBranchIds = [mainBranch._id];
      await testFood.save();

      // Thử thêm vào giỏ hàng tại mainBranch -> bị chặn 409
      const resMain = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          itemId: testFood._id.toString(),
          quantity: 1,
          branchId: mainBranch._id.toString(),
        });

      expect(resMain.status).toBe(409);
      expect(resMain.body.message).toContain("tạm hết tại chi nhánh này");

      // Nhưng đặt tại branch2 (nơi không bị tắt) -> thành công 200
      const resBranch2 = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          itemId: testFood._id.toString(),
          quantity: 1,
          branchId: branch2._id.toString(),
        });

      expect(resBranch2.status).toBe(200);
      expect(resBranch2.body.success).toBe(true);
    });
  });
});
