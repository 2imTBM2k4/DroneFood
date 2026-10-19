import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import app from "../../app.js";
import { Branch, Merchant, User } from "../../models/index.cjs";
import { createAdmin, createUser, generateToken } from "../helpers.js";

describe("Create Branch Manager Integration", () => {
  let admin, adminToken;
  let owner, ownerToken;
  let otherOwner, otherOwnerToken;
  let customer, customerToken;
  let merchant, branchWithoutManager, branchWithManager;

  beforeEach(async () => {
    admin = await createAdmin();
    adminToken = generateToken(admin._id);

    owner = await createUser({
      name: "Chủ Thương Hiệu",
      email: `owner-${Date.now()}@test.com`,
      role: "merchant_owner",
    });
    ownerToken = generateToken(owner._id);

    otherOwner = await createUser({
      name: "Chủ Chuỗi Khác",
      email: `other-owner-${Date.now()}@test.com`,
      role: "merchant_owner",
    });
    otherOwnerToken = generateToken(otherOwner._id);

    customer = await createUser({
      name: "Khách Hàng",
      email: `customer-${Date.now()}@test.com`,
      role: "user",
    });
    customerToken = generateToken(customer._id);

    merchant = await Merchant.create({
      name: "Cơm Tấm Sài Gòn",
      slug: `com-tam-sg-${Date.now()}`,
      ownerUserId: owner._id,
      status: "active",
      type: "brand",
    });

    branchWithoutManager = await Branch.create({
      merchantId: merchant._id,
      name: "Cơ sở Bình Thạnh",
      code: "BT",
      status: "active",
      isOpen: true,
      managerUserIds: [],
      address: { text: "456 Xô Viết Nghệ Tĩnh, Bình Thạnh" },
    });

    const existingManager = await createUser({
      name: "Quản Lý Đã Có",
      email: `existing-mgr-${Date.now()}@test.com`,
      role: "branch_manager",
    });

    branchWithManager = await Branch.create({
      merchantId: merchant._id,
      name: "Cơ sở Quận 1",
      code: "Q1",
      status: "active",
      isOpen: true,
      managerUserIds: [existingManager._id],
      address: { text: "123 Lê Duẩn, Q1" },
    });
  });

  it("cho phép chủ thương hiệu tạo mới tài khoản và bổ nhiệm quản lý cho chi nhánh", async () => {
    const managerEmail = `new-manager-${Date.now()}@branch.com`;
    const res = await request(app)
      .post(`/api/branch/${branchWithoutManager._id}/managers/create`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Nguyễn Văn Quản Lý",
        email: managerEmail,
        password: "password123",
        phone: "0909123456",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.manager.email).toBe(managerEmail);
    expect(res.body.data.manager.role).toBe("branch_manager");

    // Kiểm tra trong DB
    const createdUser = await User.findOne({ email: managerEmail });
    expect(createdUser).toBeTruthy();
    expect(createdUser.role).toBe("branch_manager");
    expect(createdUser.isEmailVerified).toBe(true);
    const passwordMatches = await bcrypt.compare("password123", createdUser.password);
    expect(passwordMatches).toBe(true);

    const updatedBranch = await Branch.findById(branchWithoutManager._id);
    expect(updatedBranch.managerUserIds).toHaveLength(1);
    expect(updatedBranch.managerUserIds[0].toString()).toBe(createdUser._id.toString());
  });

  it("từ chối tạo mới nếu chi nhánh đã có sẵn 1 quản lý (ràng buộc 1 quản lý/chi nhánh)", async () => {
    const res = await request(app)
      .post(`/api/branch/${branchWithManager._id}/managers/create`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Quản Lý Thừa",
        email: `extra-mgr-${Date.now()}@branch.com`,
        password: "password123",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("đã có quản lý");
  });

  it("từ chối nếu email đã tồn tại trong hệ thống", async () => {
    const res = await request(app)
      .post(`/api/branch/${branchWithoutManager._id}/managers/create`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Trùng Email",
        email: customer.email,
        password: "password123",
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Email này đã được sử dụng");
  });

  it("từ chối nếu chủ thương hiệu khác cố tình tạo quản lý cho chi nhánh không thuộc quyền mình", async () => {
    const res = await request(app)
      .post(`/api/branch/${branchWithoutManager._id}/managers/create`)
      .set("Authorization", `Bearer ${otherOwnerToken}`)
      .send({
        name: "Xâm Nhập",
        email: `hacker-${Date.now()}@branch.com`,
        password: "password123",
      });

    expect(res.status).toBe(403);
  });

  it("từ chối nếu người dùng thông thường cố tình gọi API tạo quản lý", async () => {
    const res = await request(app)
      .post(`/api/branch/${branchWithoutManager._id}/managers/create`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        name: "User Thường",
        email: `user-hack-${Date.now()}@branch.com`,
        password: "password123",
      });

    expect(res.status).toBe(403);
  });
});
