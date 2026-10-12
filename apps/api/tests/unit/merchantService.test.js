import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import * as merchantService from "../../services/merchantService.js";
import { User, Merchant, Branch } from "../../models/index.cjs";

describe("merchantService", () => {
  describe("registerMerchant", () => {
    it("creates a merchant and default MAIN branch, and updates user role to merchant_owner", async () => {
      const user = await User.create({
        name: "Nguyễn Văn Chủ",
        email: "chuquanan@test.com",
        password: "password123",
        role: "restaurant_owner",
      });

      const result = await merchantService.registerMerchant({
        userId: user._id,
        name: "Quán Ăn Ngon",
        address: { text: "123 Lê Lợi, Q1", lat: 10.775, lng: 106.700 },
        phone: "0901234567",
        images: ["https://example.com/logo.jpg", "https://example.com/cover.jpg"],
      });

      expect(result.merchant).toBeDefined();
      expect(result.merchant.name).toBe("Quán Ăn Ngon");
      expect(result.merchant.slug).toBe("quan-an-ngon");
      expect(result.merchant.status).toBe("pending");
      expect(result.merchant.type).toBe("individual");
      expect(result.merchant.branchCount).toBe(1);
      expect(result.merchant.ownerUserId.toString()).toBe(user._id.toString());

      expect(result.branch).toBeDefined();
      expect(result.branch.code).toBe("MAIN");
      expect(result.branch.name).toBe("Chi nhánh chính");
      expect(result.branch.merchantId.toString()).toBe(result.merchant._id.toString());
      expect(result.branch.address.text).toBe("123 Lê Lợi, Q1");
      expect(result.branch.location.coordinates).toEqual([106.700, 10.775]);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.role).toBe("merchant_owner");
    });

    it("rejects with 409 if user already owns a merchant", async () => {
      const user = await User.create({
        name: "Chủ Quán 2",
        email: "chuquan2@test.com",
        password: "password123",
        role: "user",
      });

      await merchantService.registerMerchant({
        userId: user._id,
        name: "Quán Lần 1",
        address: "Hà Nội",
      });

      await expect(
        merchantService.registerMerchant({
          userId: user._id,
          name: "Quán Lần 2",
          address: "Đà Nẵng",
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Bạn đã sở hữu một merchant",
      });
    });

    it("resolves slug collision deterministically", async () => {
      const user1 = await User.create({
        name: "User 1",
        email: "user1@test.com",
        password: "password123",
      });
      const user2 = await User.create({
        name: "User 2",
        email: "user2@test.com",
        password: "password123",
      });

      const res1 = await merchantService.registerMerchant({
        userId: user1._id,
        name: "Phở Gia Truyền",
        address: "Hà Nội",
      });
      const res2 = await merchantService.registerMerchant({
        userId: user2._id,
        name: "Phở Gia Truyền",
        address: "TP HCM",
      });

      expect(res1.merchant.slug).toBe("pho-gia-truyen");
      expect(res2.merchant.slug).toBe("pho-gia-truyen-1");
    });
  });

  describe("approveMerchant", () => {
    it("approves pending merchant and activates its pending branches", async () => {
      const adminId = new mongoose.Types.ObjectId();
      const ownerId = new mongoose.Types.ObjectId();

      const merchant = await Merchant.create({
        name: "Bánh Canh Cua",
        slug: "banh-canh-cua",
        ownerUserId: ownerId,
        status: "pending",
      });

      const branch = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh chính",
        code: "MAIN",
        status: "pending",
      });

      const approved = await merchantService.approveMerchant(merchant._id, adminId);
      expect(approved.status).toBe("active");
      expect(approved.approvedBy.toString()).toBe(adminId.toString());
      expect(approved.approvedAt).toBeInstanceOf(Date);

      const updatedBranch = await Branch.findById(branch._id);
      expect(updatedBranch.status).toBe("active");
    });

    it("throws 400 when approving merchant that is already active", async () => {
      const adminId = new mongoose.Types.ObjectId();
      const merchant = await Merchant.create({
        name: "Đã Active",
        slug: "da-active",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
      });

      await expect(
        merchantService.approveMerchant(merchant._id, adminId)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Chỉ có thể duyệt merchant đang ở trạng thái pending hoặc suspended",
      });
    });

    it("activates suspended merchant without auto-restoring branch status or open state", async () => {
      const adminId = new mongoose.Types.ObjectId();
      const merchant = await Merchant.create({
        name: "Merchant Bị Tạm Đình Chỉ",
        slug: "merchant-bi-tam-dinh-chi",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "suspended",
      });

      const branch = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh cũ",
        code: "MAIN",
        status: "locked",
        isOpen: false,
      });

      const unSuspended = await merchantService.approveMerchant(merchant._id, adminId);
      expect(unSuspended.status).toBe("active");

      const checkedBranch = await Branch.findById(branch._id);
      expect(checkedBranch.status).toBe("locked");
      expect(checkedBranch.isOpen).toBe(false);
    });
  });

  describe("suspendMerchant", () => {
    it("suspends active merchant, records reason, and closes all its branches", async () => {
      const adminId = new mongoose.Types.ObjectId();
      const merchant = await Merchant.create({
        name: "Trà Sữa Vi Phạm",
        slug: "tra-sua-vi-pham",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
      });

      const branch = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh chính",
        code: "MAIN",
        status: "active",
        isOpen: true,
      });

      const suspended = await merchantService.suspendMerchant(
        merchant._id,
        adminId,
        "Vi phạm quy định an toàn vệ sinh thực phẩm"
      );

      expect(suspended.status).toBe("suspended");
      expect(suspended.rejectReason).toBe("Vi phạm quy định an toàn vệ sinh thực phẩm");

      const updatedBranch = await Branch.findById(branch._id);
      expect(updatedBranch.isOpen).toBe(false);
    });
  });

  describe("getPublicMerchantBySlug", () => {
    it("returns active merchant and branches while hiding sensitive fields", async () => {
      const ownerId = new mongoose.Types.ObjectId();
      const merchant = await Merchant.create({
        name: "Highland Coffee",
        slug: "highland-coffee",
        ownerUserId: ownerId,
        status: "active",
        revenueShare: { merchant: 0.85, platform: 0.15 },
      });

      const b1 = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh Nguyễn Huệ",
        code: "NH",
        status: "active",
        isOpen: true,
      });

      const b2 = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh Đang sửa chữa",
        code: "SC",
        status: "locked",
      });

      const result = await merchantService.getPublicMerchantBySlug("highland-coffee");
      expect(result.merchant).toBeDefined();
      expect(result.merchant.name).toBe("Highland Coffee");
      // Sensitive fields must be hidden
      expect(result.merchant.ownerUserId).toBeUndefined();
      expect(result.merchant.revenueShare).toBeUndefined();

      expect(result.branches).toHaveLength(1);
      expect(result.branches[0]._id.toString()).toBe(b1._id.toString());
    });

    it("throws 404 for non-existent or inactive merchant", async () => {
      await expect(
        merchantService.getPublicMerchantBySlug("non-existent-slug")
      ).rejects.toMatchObject({
        statusCode: 404,
      });

      await Merchant.create({
        name: "Tạm Khóa",
        slug: "tam-khoa",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "suspended",
      });

      await expect(
        merchantService.getPublicMerchantBySlug("tam-khoa")
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
