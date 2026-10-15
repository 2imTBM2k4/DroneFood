import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../app.js";
import {
  AuditLog,
  Branch,
  Cart,
  Drone,
  Food,
  Hub,
  Merchant,
  Order,
  Restaurant,
  User,
} from "../../models/index.cjs";
import { createAdmin, createUser, generateToken } from "../helpers.js";

describe("Multi-Branch Full Business Flows", () => {
  let admin, adminToken;

  beforeEach(async () => {
    admin = await createAdmin();
    adminToken = generateToken(admin._id);

    await Branch.createIndexes();
    await Merchant.createIndexes();
    await Hub.createIndexes();
  });

  describe("Flow 1: Hộ kinh doanh đăng ký → bán hàng → drone bay", () => {
    it("completes full lifecycle from merchant registration to drone delivery and audit logging", async () => {
      // 0. Tạo Hub mặc định của platform
      const defaultHub = await Hub.create({
        name: "Hub Trung Tâm",
        code: `HUB-TT-${Date.now()}`,
        address: { text: "123 Lê Duẩn, Q1", lat: 10.7769, lng: 106.7009 },
        location: { type: "Point", coordinates: [106.7009, 10.7769] },
        status: "active",
      });

      // 1. User X đăng ký tài khoản (role: user)
      const userX = await createUser({
        name: "Nguyễn Văn X",
        email: `merchant-x-${Date.now()}@test.com`,
        role: "user",
      });
      const tokenX = generateToken(userX._id);

      // 2. User X gọi POST /api/merchant/register
      const regRes = await request(app)
        .post("/api/merchant/register")
        .set("Authorization", `Bearer ${tokenX}`)
        .send({
          name: "Tiệm Cơm Tấm X",
          address: {
            text: "123 Lê Duẩn, Q1",
            lat: 10.776,
            lng: 106.700,
          },
          phone: "0911223344",
        });

      expect(regRes.status).toBe(201);
      const merchant = regRes.body.data.merchant;
      const branchMain = regRes.body.data.branch;
      expect(merchant.type).toBe("individual");
      expect(merchant.status).toBe("pending");
      expect(branchMain.code).toBe("MAIN");
      expect(branchMain.status).toBe("pending");

      // 3. Admin approve → merchant active, branch MAIN active
      const approveRes = await request(app)
        .post(`/api/merchant/${merchant._id}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(approveRes.status).toBe(200);

      const approvedMerchant = await Merchant.findById(merchant._id);
      const approvedBranch = await Branch.findById(branchMain._id);
      expect(approvedMerchant.status).toBe("active");
      expect(approvedBranch.status).toBe("active");

      // 3.5 Owner mở cửa chi nhánh MAIN và bật giao hàng Drone
      await request(app)
        .patch(`/api/branch/${branchMain._id}/open-state`)
        .set("Authorization", `Bearer ${tokenX}`)
        .send({ isOpen: true });

      const submitted = await request(app).post(`/api/branch/${branchMain._id}/drone-application`)
        .set("Authorization", `Bearer ${tokenX}`)
        .send({ address: { text: "123 Lê Duẩn, Q1", lat: 10.776, lng: 106.700 }, contactName: "Nguyễn Văn X", contactPhone: "0911223344", handoverNotes: "Bàn giao ở sân trước" });
      expect(submitted.status).toBe(201);
      const reviewed = await request(app).post(`/api/branch/${branchMain._id}/drone-application/decision`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ submissionId: submitted.body.data.droneDeliveryApplication.submissionId, decision: "approved", reason: "Vị trí phù hợp" });
      expect(reviewed.status).toBe(200);
      expect(reviewed.body.data.droneDeliveryEnabled).toBe(false);

      const toggleDroneRes = await request(app)
        .patch(`/api/branch/${branchMain._id}/drone-delivery`)
        .set("Authorization", `Bearer ${tokenX}`)
        .send({ enabled: true });
      expect(toggleDroneRes.status).toBe(200);
      expect(toggleDroneRes.body.data.droneDeliveryEnabled).toBe(true);

      // Tạo sẵn drone thuộc Hub mặc định (không thuộc branch)
      const drone = await Drone.create({
        hubId: defaultHub._id,
        droneCode: `DRONE-X-${Date.now()}`,
        status: "available",
        batteryLevel: 95,
      });

      // 4. User X add food với merchantId của mình
      const food = await Food.create({
        merchantId: approvedMerchant._id,
        name: "Cơm Sườn Nướng X",
        description: "Sườn mềm thơm ngon",
        price: 45000,
        category: "Cơm",
        image: "https://example.com/suon.jpg",
      });

      // 5. Customer Y add food vào cart với branchId = branch MAIN
      const customerY = await createUser({
        name: "Trần Thị Y",
        email: `customer-y-${Date.now()}@test.com`,
        role: "user",
      });
      const tokenY = generateToken(customerY._id);

      const cartRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${tokenY}`)
        .send({
          itemId: food._id.toString(),
          quantity: 2,
          branchId: approvedBranch._id.toString(),
        });
      expect(cartRes.status).toBe(200);
      expect(cartRes.body.branchId).toBe(approvedBranch._id.toString());
      expect(cartRes.body.merchantId).toBe(approvedMerchant._id.toString());

      // 6. Customer Y place order với branchId (Drone delivery yêu cầu thanh toán trực tuyến)
      const placeRes = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${tokenY}`)
        .send({
          cartId: cartRes.body.cartId,
          cartVersion: cartRes.body.cartVersion,
          branchId: approvedBranch._id.toString(),
          paymentMethod: "VNPAY",
          deliveryMethod: "drone",
          address: {
            fullName: "Trần Thị Y",
            phone: "0988776655",
            address: "50 Hai Bà Trưng, Q1",
            city: "TP HCM",
            state: "TP HCM",
            country: "Vietnam",
            lat: 10.778,
            lng: 106.702,
          },
        });
      expect(placeRes.status).toBe(200);
      const orderId = placeRes.body.orderId;

      // Giả lập thanh toán trực tuyến thành công cho đơn drone
      await Order.findByIdAndUpdate(orderId, {
        isPaid: true,
        orderStatus: "pending",
      });

      // 7. Merchant accept order → status='preparing'
      const prepRes = await request(app)
        .post("/api/order/status")
        .set("Authorization", `Bearer ${tokenX}`)
        .send({
          orderId,
          status: "preparing",
        });
      expect(prepRes.status).toBe(200);

      // 8. Merchant update status='delivering' → drone tự assign từ Hub và bay tới chi nhánh lấy hàng
      const deliverRes = await request(app)
        .post("/api/order/status")
        .set("Authorization", `Bearer ${tokenX}`)
        .send({
          orderId,
          status: "delivering",
        });
      expect(deliverRes.status).toBe(200);

      // 9. Verify: order.branchId = branch MAIN, order.merchantId = merchant, drone.hubId = defaultHub._id
      const finalOrder = await Order.findById(orderId);
      expect(finalOrder.branchId.toString()).toBe(approvedBranch._id.toString());
      expect(finalOrder.merchantId.toString()).toBe(approvedMerchant._id.toString());
      expect(finalOrder.droneId).toBeDefined();
      expect(finalOrder.droneId.toString()).toBe(drone._id.toString());

      const assignedDrone = await Drone.findById(finalOrder.droneId);
      expect(assignedDrone.branchId).toBeUndefined();
      expect(assignedDrone.hubId.toString()).toBe(defaultHub._id.toString());
      expect(assignedDrone.status).toBe("flying_to_branch");
      expect(assignedDrone.currentOrder.toString()).toBe(finalOrder._id.toString());

      // 10. Audit log có merchantId + branchId
      const auditEntry = await AuditLog.findOne({
        targetType: "order",
        targetId: finalOrder._id,
        action: "order.place",
      });
      expect(auditEntry).toBeDefined();
      expect(auditEntry.merchantId.toString()).toBe(approvedMerchant._id.toString());
      expect(auditEntry.branchId.toString()).toBe(approvedBranch._id.toString());
    });
  });

  describe("Flow 2: Thêm/xóa branch → type chuyển đổi", () => {
    it("switches type individual ↔ brand and prevents deleting the last branch", async () => {
      // 1. Merchant type='individual', branchCount=1
      const owner = await createUser({ role: "merchant_owner" });
      const ownerToken = generateToken(owner._id);

      const merchant = await Merchant.create({
        name: "Bánh Mì Huỳnh Hoa",
        slug: `banh-mi-hh-${Date.now()}`,
        ownerUserId: owner._id,
        status: "active",
        type: "individual",
        branchCount: 1,
      });

      const branch1 = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh chính",
        code: "MAIN",
        status: "active",
      });

      // 2. Owner tạo branch thứ 2
      const createRes = await request(app)
        .post("/api/branch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          merchantId: merchant._id.toString(),
          name: "Chi nhánh 2",
          code: "CN2",
          address: "20 Pasteur, Q1",
        });
      expect(createRes.status).toBe(201);
      const branch2Id = createRes.body.data._id;

      // 3. Verify merchant.type === 'brand' và branchCount=2
      let reloadedMerchant = await Merchant.findById(merchant._id);
      expect(reloadedMerchant.branchCount).toBe(2);
      expect(reloadedMerchant.type).toBe("brand");

      // 4. Owner xóa branch thứ 2
      const deleteRes = await request(app)
        .delete(`/api/branch/${branch2Id}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(deleteRes.status).toBe(200);

      // 5. Verify merchant.type === 'individual' và branchCount=1
      reloadedMerchant = await Merchant.findById(merchant._id);
      expect(reloadedMerchant.branchCount).toBe(1);
      expect(reloadedMerchant.type).toBe("individual");

      // 6. Owner cố xóa branch cuối → 400 AppError
      const deleteLastRes = await request(app)
        .delete(`/api/branch/${branch1._id}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(deleteLastRes.status).toBe(400);
      expect(deleteLastRes.body.message).toContain("Không thể xóa chi nhánh duy nhất");
    });
  });

  describe("Flow 3: branch_manager permission", () => {
    it("strictly isolates branch_manager permissions from other branches and merchant-wide actions", async () => {
      // 1. Merchant brand có 2 branch: A và B
      const owner = await createUser({ role: "merchant_owner" });
      const ownerToken = generateToken(owner._id);

      const managerM = await createUser({
        name: "Manager M",
        role: "branch_manager",
      });
      const managerToken = generateToken(managerM._id);

      const merchant = await Merchant.create({
        name: "Highlands Brand",
        slug: `highlands-brand-${Date.now()}`,
        ownerUserId: owner._id,
        status: "active",
        type: "brand",
        branchCount: 2,
      });

      const branchA = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh A",
        code: "CNA",
        status: "active",
        managerUserIds: [],
      });

      const branchB = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh B",
        code: "CNB",
        status: "active",
        managerUserIds: [],
      });

      // 2. Owner gán User M làm manager của branch A
      const assignRes = await request(app)
        .post(`/api/branch/${branchA._id}/managers`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ userIds: [managerM._id.toString()] });
      expect(assignRes.status).toBe(200);

      // Tạo 1 order ở A và 1 order ở B
      const customer = await createUser({ role: "user" });
      const orderA = await Order.create({
        user: customer._id,
        merchantId: merchant._id,
        branchId: branchA._id,
        totalPrice: 50000,
        paymentMethod: "COD",
        deliveryMethod: "shipper",
        orderStatus: "pending",
        shippingAddress: { fullName: "A", address: "B", city: "C", state: "D", country: "E", phone: "1" },
      });

      const orderB = await Order.create({
        user: customer._id,
        merchantId: merchant._id,
        branchId: branchB._id,
        totalPrice: 50000,
        paymentMethod: "COD",
        deliveryMethod: "shipper",
        orderStatus: "pending",
        shippingAddress: { fullName: "A", address: "B", city: "C", state: "D", country: "E", phone: "1" },
      });

      // 3. User M login:
      // - GET /api/order/list → chỉ thấy order của branch A
      const listRes = await request(app)
        .get("/api/order/list")
        .set("Authorization", `Bearer ${managerToken}`);
      expect(listRes.status).toBe(200);
      const listIds = listRes.body.data.map((o) => o._id.toString());
      expect(listIds).toContain(orderA._id.toString());
      expect(listIds).not.toContain(orderB._id.toString());

      // - GET /api/order/list?branchId=B → 403
      const listBRes = await request(app)
        .get("/api/order/list")
        .set("Authorization", `Bearer ${managerToken}`)
        .query({ branchId: branchB._id.toString() });
      expect(listBRes.status).toBe(403);

      // - PUT /api/branch/B → 403
      const updateBRes = await request(app)
        .put(`/api/branch/${branchB._id}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ phone: "0999999999" });
      expect(updateBRes.status).toBe(403);

      // - PUT /api/branch/A → OK
      const updateARes = await request(app)
        .put(`/api/branch/${branchA._id}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ phone: "0988888888" });
      expect(updateARes.status).toBe(200);
      expect(updateARes.body.data.phone).toBe("0988888888");

      // - POST /api/drone/create → 403 (chỉ admin / merchant_owner)
      const droneCreateRes = await request(app)
        .post("/api/drone/create")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          branchId: branchA._id.toString(),
          droneCode: `DRONE-FAIL-${Date.now()}`,
        });
      expect(droneCreateRes.status).toBe(403);

      // - GET /api/audit?merchantId=... → 403 (không thấy toàn brand)
      const auditRes = await request(app)
        .get("/api/audit")
        .set("Authorization", `Bearer ${managerToken}`)
        .query({ merchantId: merchant._id.toString() });
      expect(auditRes.status).toBe(403);
    });
  });

  describe("Flow 4: Cart cross-branch", () => {
    it("enforces single-branch cart and allows switching branch after clear cart", async () => {
      const owner = await createUser({ role: "merchant_owner" });
      const merchant = await Merchant.create({
        name: "Trà Sữa Koi",
        slug: `tra-sua-koi-${Date.now()}`,
        ownerUserId: owner._id,
        status: "active",
      });

      const branchA = await Branch.create({
        merchantId: merchant._id,
        name: "Branch A",
        code: "CNA",
        status: "active",
        isOpen: true,
      });

      const branchB = await Branch.create({
        merchantId: merchant._id,
        name: "Branch B",
        code: "CNB",
        status: "active",
        isOpen: true,
      });

      const food = await Food.create({
        merchantId: merchant._id,
        name: "Trà sữa trân châu",
        description: "Trà sữa đậm vị",
        price: 35000,
        category: "Trà sữa",
        image: "https://example.com/tra-sua.jpg",
      });

      const customer = await createUser({ role: "user" });
      const token = generateToken(customer._id);

      // 1. Customer add food từ branch A → cart OK, cart.branchId = A
      const addARes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${token}`)
        .send({
          itemId: food._id.toString(),
          quantity: 1,
          branchId: branchA._id.toString(),
        });
      expect(addARes.status).toBe(200);
      expect(addARes.body.branchId).toBe(branchA._id.toString());
      const cartId = addARes.body.cartId;

      // 2. Customer add food từ branch B → 409
      const addBRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${token}`)
        .send({
          itemId: food._id.toString(),
          quantity: 1,
          branchId: branchB._id.toString(),
        });
      expect(addBRes.status).toBe(409);
      expect(addBRes.body.message).toContain("Giỏ hàng chỉ chứa món từ 1 chi nhánh");

      // 3. Customer clear cart → add food từ branch B → OK
      const clearRes = await request(app)
        .delete(`/api/cart/${cartId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(clearRes.status).toBe(200);

      const addBRetryRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${token}`)
        .send({
          itemId: food._id.toString(),
          quantity: 2,
          branchId: branchB._id.toString(),
        });
      expect(addBRetryRes.status).toBe(200);
      expect(addBRetryRes.body.branchId).toBe(branchB._id.toString());
    });
  });

  describe("Flow 5: Multi-branch nearby", () => {
    it("groups branches by merchant, selects nearest, lists otherBranches, and filters suspended/out-of-range", async () => {
      // Customer location: [106.700, 10.770]
      const owner1 = await createUser({ role: "merchant_owner" });
      const activeBrand = await Merchant.create({
        name: "Brand Chuỗi 3 Chi Nhánh",
        slug: `brand-3-branches-${Date.now()}`,
        ownerUserId: owner1._id,
        status: "active",
        type: "brand",
        branchCount: 3,
      });

      // Branch X: gần customer (~150m)
      const branchX = await Branch.create({
        merchantId: activeBrand._id,
        name: "Chi nhánh X (Gần)",
        code: "X",
        isOpen: true,
        status: "active",
        location: { type: "Point", coordinates: [106.7012, 10.770] },
      });

      // Branch Y: trung bình (~2km)
      const branchY = await Branch.create({
        merchantId: activeBrand._id,
        name: "Chi nhánh Y (Trung bình)",
        code: "Y",
        isOpen: true,
        status: "active",
        location: { type: "Point", coordinates: [106.718, 10.770] },
      });

      // Branch Z: xa (~35km, nhưng trong MAX 50km)
      const branchZ = await Branch.create({
        merchantId: activeBrand._id,
        name: "Chi nhánh Z (Xa)",
        code: "Z",
        isOpen: true,
        status: "active",
        location: { type: "Point", coordinates: [106.900, 10.770] },
      });

      // Branch Out: quá xa (> 60km, ngoài max radius)
      await Branch.create({
        merchantId: activeBrand._id,
        name: "Chi nhánh Quá Xa",
        code: "OUT",
        isOpen: true,
        status: "active",
        location: { type: "Point", coordinates: [107.500, 10.770] },
      });

      // Merchant Suspended
      const owner2 = await createUser({ role: "merchant_owner" });
      const suspendedBrand = await Merchant.create({
        name: "Brand Đình Chỉ",
        slug: `brand-suspended-${Date.now()}`,
        ownerUserId: owner2._id,
        status: "suspended",
        type: "individual",
      });

      await Branch.create({
        merchantId: suspendedBrand._id,
        name: "Chi nhánh của brand đình chỉ",
        code: "MAIN",
        isOpen: true,
        status: "active",
        location: { type: "Point", coordinates: [106.702, 10.770] },
      });

      // Query with radius = 15km
      const res15 = await request(app)
        .get("/api/branch/nearby")
        .query({ lat: 10.770, lng: 106.700, radius: 15 });

      expect(res15.status).toBe(200);
      expect(res15.body.success).toBe(true);
      expect(res15.body.data).toHaveLength(1);

      const brandEntry = res15.body.data[0];
      expect(brandEntry.merchant._id.toString()).toBe(activeBrand._id.toString());
      expect(brandEntry.nearestBranch._id.toString()).toBe(branchX._id.toString());
      expect(brandEntry.otherBranches).toHaveLength(1);
      expect(brandEntry.otherBranches[0]._id.toString()).toBe(branchY._id.toString());
      // Branch Z is >15km away, so excluded with radius=15km

      // Query with radius = 45km -> Branch Z included in otherBranches
      const res45 = await request(app)
        .get("/api/branch/nearby")
        .query({ lat: 10.770, lng: 106.700, radius: 45 });

      expect(res45.status).toBe(200);
      const brandEntry45 = res45.body.data[0];
      expect(brandEntry45.otherBranches).toHaveLength(2);
      const otherCodes = brandEntry45.otherBranches.map((b) => b.code);
      expect(otherCodes).toContain("Y");
      expect(otherCodes).toContain("Z");

      // Suspended brand branch is completely absent
      const suspendedEntry = res45.body.data.find(
        (b) => b.merchant._id.toString() === suspendedBrand._id.toString()
      );
      expect(suspendedEntry).toBeUndefined();
    });
  });

  describe("Flow 6: Cart legacy → branch transition", () => {
    it("returns 409 conflict when adding with branchId while possessing legacy cart with items, and succeeds after cart is cleared", async () => {
      const owner = await createUser({ role: "merchant_owner" });
      const merchant = await Merchant.create({
        name: "Phở Legacy Chuyển Đổi",
        slug: `pho-legacy-trans-${Date.now()}`,
        ownerUserId: owner._id,
        status: "active",
      });

      const branch = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh chính",
        code: "MAIN",
        status: "active",
        isOpen: true,
      });

      const food = await Food.create({
        merchantId: merchant._id,
        name: "Phở Bò",
        description: "Phở bò thơm ngon",
        price: 50000,
        category: "Phở",
        image: "https://example.com/pho.jpg",
      });

      const customer = await createUser({ role: "user" });
      const token = generateToken(customer._id);

      const oldRestaurant = await Restaurant.create({
        name: "Nhà hàng cũ",
        owner: owner._id,
        address: "Cũ",
        phone: "0123456789",
        email: "old@test.com",
      });

      // 1. User có cart legacy (restaurantId set, branchId null) có món
      const legacyCart = await Cart.create({
        userId: customer._id,
        restaurantId: oldRestaurant._id,
        items: [
          {
            lineKey: "legacy-line-1",
            foodId: food._id,
            quantity: 1,
            selectedOptions: [],
          },
        ],
      });

      // 2. Add food với branchId mới
      const addRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${token}`)
        .send({
          itemId: food._id.toString(),
          quantity: 1,
          branchId: branch._id.toString(),
        });

      // 3. Hệ thống trả về 409 với message rõ ràng yêu cầu xóa giỏ hàng trước khi chuyển chi nhánh
      expect(addRes.status).toBe(409);
      expect(addRes.body.message).toContain(
        "Giỏ hàng chỉ chứa món từ 1 chi nhánh. Xóa giỏ để thêm từ chi nhánh mới"
      );

      // 4. User xóa giỏ hàng legacy
      await Cart.deleteOne({ _id: legacyCart._id });

      // 5. Thêm lại với branchId mới -> thành công, cart mới có branchId và restaurantId null
      const retryRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${token}`)
        .send({
          itemId: food._id.toString(),
          quantity: 1,
          branchId: branch._id.toString(),
        });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.branchId).toBe(branch._id.toString());
      expect(retryRes.body.restaurantId).toBeNull();
    });
  });

  describe("Drone Delivery Platform Scenarios", () => {
    let merchant, branchWithDrone, branchNoDrone, hubNear, hubFar;
    let customer, customerToken;

    beforeEach(async () => {
      const owner = await createUser({ role: "merchant_owner" });
      merchant = await Merchant.create({
        name: "Phở Platform Drone",
        slug: `pho-platform-drone-${Date.now()}`,
        ownerUserId: owner._id,
        status: "active",
      });

      // Branch 1: coordinates [106.700, 10.770], drone enabled
      branchWithDrone = await Branch.create({
        merchantId: merchant._id,
        name: "Branch Có Drone",
        code: "B-DRONE",
        status: "active",
        isOpen: true,
        droneDeliveryEnabled: true,
        location: { type: "Point", coordinates: [106.700, 10.770] },
        address: { text: "123 Lê Duẩn", lat: 10.770, lng: 106.700 },
      });

      // Branch 2: coordinates [106.700, 10.770], drone DISABLED
      branchNoDrone = await Branch.create({
        merchantId: merchant._id,
        name: "Branch Không Drone",
        code: "B-NO-DRONE",
        status: "active",
        isOpen: true,
        droneDeliveryEnabled: false,
        location: { type: "Point", coordinates: [106.700, 10.770] },
        address: { text: "456 Nam Kỳ", lat: 10.770, lng: 106.700 },
      });

      // Hub Near: ~1km from branch [106.709, 10.770]
      hubNear = await Hub.create({
        name: "Hub Gần",
        code: `HUB-NEAR-${Date.now()}`,
        status: "active",
        location: { type: "Point", coordinates: [106.709, 10.770] },
        address: { text: "Gần", lat: 10.770, lng: 106.709 },
      });

      // Hub Far: ~20km from branch [106.880, 10.770]
      hubFar = await Hub.create({
        name: "Hub Xa",
        code: `HUB-FAR-${Date.now()}`,
        status: "active",
        location: { type: "Point", coordinates: [106.880, 10.770] },
        address: { text: "Xa", lat: 10.770, lng: 106.880 },
      });

      customer = await createUser({ role: "user" });
      customerToken = generateToken(customer._id);
    });

    it("rejects drone delivery order with 403 when branch has drone delivery disabled", async () => {
      const food = await Food.create({
        merchantId: merchant._id,
        name: "Món A",
        description: "Mô tả",
        price: 40000,
        category: "Cơm",
        image: "https://example.com/a.jpg",
      });

      const cartRes = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          itemId: food._id.toString(),
          quantity: 1,
          branchId: branchNoDrone._id.toString(),
        });

      const orderRes = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          cartId: cartRes.body.cartId,
          cartVersion: cartRes.body.cartVersion,
          branchId: branchNoDrone._id.toString(),
          paymentMethod: "VNPAY",
          deliveryMethod: "drone",
          address: {
            fullName: "Khách",
            phone: "0900000000",
            address: "Địa chỉ",
            city: "HCM",
            state: "HCM",
            country: "VN",
            lat: 10.770,
            lng: 106.700,
          },
        });

      expect(orderRes.status).toBe(403);
      expect(orderRes.body.message).toContain("chưa được duyệt hoặc chưa bật");
    });

    it("selects drone from nearest hub to branch and avoids busy or low-battery drones", async () => {
      // Drone 1 at Hub Far (available, battery 90)
      const droneFar = await Drone.create({
        hubId: hubFar._id,
        droneCode: `DRONE-FAR-${Date.now()}`,
        status: "available",
        batteryLevel: 90,
      });

      // Drone 2 at Hub Near (flying_to_branch -> busy)
      await Drone.create({
        hubId: hubNear._id,
        droneCode: `DRONE-BUSY-${Date.now()}`,
        status: "flying_to_branch",
        batteryLevel: 90,
      });

      // Drone 3 at Hub Near (low battery 20 -> cannot fly)
      await Drone.create({
        hubId: hubNear._id,
        droneCode: `DRONE-LOW-${Date.now()}`,
        status: "available",
        batteryLevel: 20,
      });

      // Drone 4 at Hub Near (available, battery 85 -> SHOULD BE CHOSEN!)
      const droneNearReady = await Drone.create({
        hubId: hubNear._id,
        droneCode: `DRONE-NEAR-OK-${Date.now()}`,
        status: "available",
        batteryLevel: 85,
      });

      const order = await Order.create({
        user: customer._id,
        merchantId: merchant._id,
        branchId: branchWithDrone._id,
        totalPrice: 50000,
        paymentMethod: "VNPAY",
        deliveryMethod: "drone",
        orderStatus: "pending",
        isPaid: true,
        shippingAddress: { fullName: "A", address: "B", city: "C", state: "D", country: "E", phone: "1" },
      });

      const { assignDroneToOrder } = await import("../../services/droneService.js");
      const result = await assignDroneToOrder(order._id);

      expect(result.success).toBe(true);
      expect(result.data.droneId.toString()).toBe(droneNearReady._id.toString());

      const assigned = await Drone.findById(droneNearReady._id);
      expect(assigned.status).toBe("flying_to_branch");
      expect(assigned.currentOrder.toString()).toBe(order._id.toString());
    });

    it("allows drone returning to hub to become available and accept new orders", async () => {
      const drone = await Drone.create({
        hubId: hubNear._id,
        droneCode: `DRONE-RETURN-${Date.now()}`,
        status: "returning_to_hub",
        batteryLevel: 80,
      });

      const order = await Order.create({
        user: customer._id,
        merchantId: merchant._id,
        branchId: branchWithDrone._id,
        totalPrice: 50000,
        paymentMethod: "VNPAY",
        deliveryMethod: "drone",
        orderStatus: "pending",
        isPaid: true,
        shippingAddress: { fullName: "A", address: "B", city: "C", state: "D", country: "E", phone: "1" },
      });

      const { assignDroneToOrder, updateDroneStatus } = await import("../../services/droneService.js");

      // While returning_to_hub, cannot be assigned
      await expect(assignDroneToOrder(order._id)).rejects.toMatchObject({
        statusCode: 409,
        message: "Không có drone khả dụng",
      });

      // Admin or system sets drone back to available at hub
      await updateDroneStatus(drone._id, "available");
      const availableDrone = await Drone.findById(drone._id);
      expect(availableDrone.status).toBe("available");

      // Now assignment succeeds!
      const assignRes = await assignDroneToOrder(order._id);
      expect(assignRes.success).toBe(true);
      expect(assignRes.data.droneId.toString()).toBe(drone._id.toString());
    });
  });

  describe("Permissions on Drone and Hub APIs", () => {
    it("blocks merchant_owner and branch_manager from viewing drone fleet", async () => {
      const owner = await createUser({ role: "merchant_owner" });
      const manager = await createUser({ role: "branch_manager" });

      const ownerRes = await request(app)
        .get("/api/drone")
        .set("Authorization", `Bearer ${generateToken(owner._id)}`);
      expect(ownerRes.status).toBe(403);

      const managerRes = await request(app)
        .get("/api/drone")
        .set("Authorization", `Bearer ${generateToken(manager._id)}`);
      expect(managerRes.status).toBe(403);

      const adminRes = await request(app)
        .get("/api/drone")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
    });

    it("allows merchant_owner and branch_manager to toggle drone delivery on their own branch", async () => {
      const owner = await createUser({ role: "merchant_owner" });
      const manager = await createUser({ role: "branch_manager" });
      const otherUser = await createUser({ role: "merchant_owner" });

      const merchant = await Merchant.create({
        name: "Thương hiệu Toggle",
        slug: `brand-toggle-${Date.now()}`,
        ownerUserId: owner._id,
        status: "active",
      });

      const branch = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh Quản lý",
        code: "QL1",
        status: "active",
        isOpen: true,
        managerUserIds: [manager._id],
      });

      const submitRes = await request(app).post(`/api/branch/${branch._id}/drone-application`)
        .set("Authorization", `Bearer ${generateToken(manager._id)}`)
        .send({ address: { text: "1 Đồng Khởi", lat: 10.77, lng: 106.7 }, contactName: "Quản lý", contactPhone: "0901234567", handoverNotes: "Bàn giao sân trước" });
      expect(submitRes.status).toBe(201);
      const decisionRes = await request(app).post(`/api/branch/${branch._id}/drone-application/decision`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ submissionId: submitRes.body.data.droneDeliveryApplication.submissionId, decision: "approved", reason: "Đủ điều kiện" });
      expect(decisionRes.status).toBe(200);

      // Owner toggles an approved service.
      const ownerToggle = await request(app)
        .patch(`/api/branch/${branch._id}/drone-delivery`)
        .set("Authorization", `Bearer ${generateToken(owner._id)}`)
        .send({ enabled: true });
      expect(ownerToggle.status).toBe(200);
      expect(ownerToggle.body.data.droneDeliveryEnabled).toBe(true);

      // Manager toggles OK
      const managerToggle = await request(app)
        .patch(`/api/branch/${branch._id}/drone-delivery`)
        .set("Authorization", `Bearer ${generateToken(manager._id)}`)
        .send({ enabled: false });
      expect(managerToggle.status).toBe(200);
      expect(managerToggle.body.data.droneDeliveryEnabled).toBe(false);

      // Other user blocked 403
      const otherToggle = await request(app)
        .patch(`/api/branch/${branch._id}/drone-delivery`)
        .set("Authorization", `Bearer ${generateToken(otherUser._id)}`)
        .send({ enabled: true });
      expect(otherToggle.status).toBe(403);
    });
  });

  describe("Hub CRUD API (Admin Only)", () => {
    it("allows admin to create, list, and prevents deleting hub with drones", async () => {
      const nonAdmin = await createUser({ role: "merchant_owner" });

      // Non-admin cannot create hub
      const forbidCreate = await request(app)
        .post("/api/hub")
        .set("Authorization", `Bearer ${generateToken(nonAdmin._id)}`)
        .send({
          name: "Hub Hack",
          code: "HUB-HACK",
          address: "123 Đường",
        });
      expect(forbidCreate.status).toBe(403);

      // Admin creates hub
      const createRes = await request(app)
        .post("/api/hub")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Hub Bình Thạnh",
          code: "HUB-BT",
          address: { text: "12 Bạch Đằng, Bình Thạnh", lat: 10.801, lng: 106.702 },
          capacity: 30,
        });
      expect(createRes.status).toBe(201);
      const hubId = createRes.body.data._id;

      // Admin lists hubs
      const listRes = await request(app)
        .get("/api/hub")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((h) => h.code === "HUB-BT")).toBe(true);

      // Add a drone to this hub
      await Drone.create({
        hubId,
        droneCode: `DRONE-BT-${Date.now()}`,
        status: "available",
      });

      // Try deleting hub while drones exist -> 400
      const deleteFailRes = await request(app)
        .delete(`/api/hub/${hubId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(deleteFailRes.status).toBe(400);
      expect(deleteFailRes.body.message).toContain("Không thể xóa Hub đang quản lý 1 drone");

      // Delete drone first, then hub delete succeeds
      await Drone.deleteMany({ hubId });
      const deleteSuccessRes = await request(app)
        .delete(`/api/hub/${hubId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(deleteSuccessRes.status).toBe(200);
    });
  });
});
