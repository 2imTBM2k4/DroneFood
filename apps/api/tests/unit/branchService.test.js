import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import * as branchService from "../../services/branchService.js";
import { Branch, Merchant } from "../../models/index.cjs";
import {
  DEFAULT_SEARCH_RADIUS_KM,
  MAX_SEARCH_RADIUS_KM,
  MIN_SEARCH_RADIUS_KM,
} from "../../config/delivery.js";

describe("branchService", () => {
  beforeEach(async () => {
    await Branch.createIndexes();
    await Merchant.createIndexes();
  });

  describe("resolveNearestBranches", () => {
    it("groups branches by merchant and sorts by distance ascending", async () => {
      // Search point: [106.700, 10.770]
      const searchPoint = { lat: 10.770, lng: 106.700 };

      const ownerA = new mongoose.Types.ObjectId();
      const merchantA = await Merchant.create({
        name: "Thương hiệu A",
        slug: "thuong-hieu-a",
        ownerUserId: ownerA,
        status: "active",
        type: "brand",
      });

      // Branch A1: very close (~100m)
      const branchA1 = await Branch.create({
        merchantId: merchantA._id,
        name: "Chi nhánh A1",
        code: "A1",
        isOpen: true,
        status: "active",
        location: { type: "Point", coordinates: [106.701, 10.770] },
      });

      // Branch A2: further away (~2km)
      const branchA2 = await Branch.create({
        merchantId: merchantA._id,
        name: "Chi nhánh A2",
        code: "A2",
        isOpen: true,
        status: "active",
        location: { type: "Point", coordinates: [106.720, 10.770] },
      });

      const ownerB = new mongoose.Types.ObjectId();
      const merchantB = await Merchant.create({
        name: "Thương hiệu B",
        slug: "thuong-hieu-b",
        ownerUserId: ownerB,
        status: "active",
        type: "individual",
      });

      // Branch B1: medium distance (~1km)
      const branchB1 = await Branch.create({
        merchantId: merchantB._id,
        name: "Chi nhánh B1",
        code: "B1",
        isOpen: true,
        status: "active",
        location: { type: "Point", coordinates: [106.710, 10.770] },
      });

      const results = await branchService.resolveNearestBranches({
        lat: searchPoint.lat,
        lng: searchPoint.lng,
        radiusKm: 10,
      });

      expect(results).toHaveLength(2);
      // Merchant A is closest because branch A1 is closer than B1
      expect(results[0].merchant._id.toString()).toBe(merchantA._id.toString());
      expect(results[0].nearestBranch._id.toString()).toBe(branchA1._id.toString());
      expect(results[0].otherBranches).toHaveLength(1);
      expect(results[0].otherBranches[0]._id.toString()).toBe(branchA2._id.toString());

      // Merchant B is second
      expect(results[1].merchant._id.toString()).toBe(merchantB._id.toString());
      expect(results[1].nearestBranch._id.toString()).toBe(branchB1._id.toString());
      expect(results[1].otherBranches).toHaveLength(0);

      expect(results[0].distance).toBeLessThan(results[1].distance);
    });

    it("filters out branches exceeding branch.deliveryRadiusKm", async () => {
      const searchPoint = { lat: 10.770, lng: 106.700 };

      const merchant = await Merchant.create({
        name: "Pizza Radius",
        slug: "pizza-radius",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
        type: "individual",
      });

      // Branch is ~2.2km away, but deliveryRadiusKm is 1km
      await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh bán kính hẹp",
        code: "MAIN",
        isOpen: true,
        status: "active",
        deliveryRadiusKm: 1,
        location: { type: "Point", coordinates: [106.720, 10.770] },
      });

      const results = await branchService.resolveNearestBranches({
        lat: searchPoint.lat,
        lng: searchPoint.lng,
        radiusKm: 15,
      });

      expect(results).toHaveLength(0);
    });

    it("clamps radiusKm between MIN and MAX config", async () => {
      const searchPoint = { lat: 10.770, lng: 106.700 };

      const merchant = await Merchant.create({
        name: "Bún Bò Clamp",
        slug: "bun-bo-clamp",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
        type: "individual",
      });

      // Branch is ~200m away
      await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh gần",
        code: "MAIN",
        isOpen: true,
        status: "active",
        location: { type: "Point", coordinates: [106.7018, 10.770] },
      });

      // Pass radius smaller than MIN (0.01 km) -> clamped to MIN_SEARCH_RADIUS_KM (1km)
      const resultsMin = await branchService.resolveNearestBranches({
        lat: searchPoint.lat,
        lng: searchPoint.lng,
        radiusKm: 0.01,
      });
      expect(resultsMin).toHaveLength(1);

      // Pass radius larger than MAX (1000 km) -> clamped to MAX_SEARCH_RADIUS_KM
      const resultsMax = await branchService.resolveNearestBranches({
        lat: searchPoint.lat,
        lng: searchPoint.lng,
        radiusKm: 1000,
      });
      expect(resultsMax).toHaveLength(1);
    });

    it("filters out branches whose merchant is suspended or pending", async () => {
      const searchPoint = { lat: 10.770, lng: 106.700 };

      const suspendedMerchant = await Merchant.create({
        name: "Thương hiệu Bị Khóa",
        slug: "thuong-hieu-bi-khoa",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "suspended",
        type: "individual",
      });

      await Branch.create({
        merchantId: suspendedMerchant._id,
        name: "Chi nhánh treo",
        code: "MAIN",
        isOpen: true,
        status: "active",
        location: { type: "Point", coordinates: [106.701, 10.770] },
      });

      const results = await branchService.resolveNearestBranches({
        lat: searchPoint.lat,
        lng: searchPoint.lng,
        radiusKm: 10,
      });

      expect(results).toHaveLength(0);
    });

    it("filters out branches that are closed (isOpen=false) or locked", async () => {
      const searchPoint = { lat: 10.770, lng: 106.700 };

      const merchant = await Merchant.create({
        name: "Thương hiệu Đóng Cửa",
        slug: "thuong-hieu-dong-cua",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
        type: "individual",
      });

      // Branch closed
      await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh đóng cửa",
        code: "CN1",
        isOpen: false,
        status: "active",
        location: { type: "Point", coordinates: [106.701, 10.770] },
      });

      // Branch locked
      await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh bị khóa",
        code: "CN2",
        isOpen: true,
        status: "locked",
        location: { type: "Point", coordinates: [106.702, 10.770] },
      });

      const results = await branchService.resolveNearestBranches({
        lat: searchPoint.lat,
        lng: searchPoint.lng,
        radiusKm: 10,
      });

      expect(results).toHaveLength(0);
    });
  });

  describe("syncMerchantBranchCount", () => {
    it("sets branchCount=1 and type='individual' when 1 active branch exists", async () => {
      const merchant = await Merchant.create({
        name: "Hộ Kinh Doanh",
        slug: "ho-kinh-doanh",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
        type: "brand",
        branchCount: 0,
      });

      await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh 1",
        code: "MAIN",
        status: "active",
      });

      const updated = await branchService.syncMerchantBranchCount(merchant._id);
      expect(updated.branchCount).toBe(1);
      expect(updated.type).toBe("individual");
    });

    it("sets branchCount=2 and type='brand' when 2 or more active branches exist", async () => {
      const merchant = await Merchant.create({
        name: "Chuỗi Cà Phê",
        slug: "chuoi-ca-phe",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
        type: "individual",
        branchCount: 1,
      });

      await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh 1",
        code: "MAIN",
        status: "active",
      });
      await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh 2",
        code: "CN2",
        status: "active",
      });

      const updated = await branchService.syncMerchantBranchCount(merchant._id);
      expect(updated.branchCount).toBe(2);
      expect(updated.type).toBe("brand");
    });

    it("switches type back to 'individual' when branches reduced to 1", async () => {
      const merchant = await Merchant.create({
        name: "Cơm Tấm Đổi Quy Mô",
        slug: "com-tam-doi-quy-mo",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
        type: "brand",
        branchCount: 2,
      });

      const b1 = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh 1",
        code: "MAIN",
        status: "active",
      });
      const b2 = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh 2",
        code: "CN2",
        status: "locked", // Inactive branch
      });

      const updated = await branchService.syncMerchantBranchCount(merchant._id);
      expect(updated.branchCount).toBe(1);
      expect(updated.type).toBe("individual");
    });
  });

  describe("assertBranchOperational", () => {
    it("returns branch and merchant when both are operational and active", async () => {
      const merchant = await Merchant.create({
        name: "Cơm Niêu Sài Gòn",
        slug: "com-nieu-sai-gon",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
        type: "individual",
      });

      const branch = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh chính",
        code: "MAIN",
        status: "active",
        isOpen: true,
      });

      const result = await branchService.assertBranchOperational(branch._id);
      expect(result.branch._id.toString()).toBe(branch._id.toString());
      expect(result.merchant._id.toString()).toBe(merchant._id.toString());
    });

    it("throws 404 when branch does not exist", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(
        branchService.assertBranchOperational(nonExistentId)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 403 when branch is locked or not active", async () => {
      const merchant = await Merchant.create({
        name: "Trà Đào Locked",
        slug: "tra-dao-locked",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
      });

      const branch = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh bị khóa",
        code: "MAIN",
        status: "locked",
        isOpen: true,
      });

      await expect(
        branchService.assertBranchOperational(branch._id)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Chi nhánh không hoạt động",
      });
    });

    it("throws 403 when branch is closed (isOpen=false)", async () => {
      const merchant = await Merchant.create({
        name: "Trà Đào Closed",
        slug: "tra-dao-closed",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "active",
      });

      const branch = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh đóng cửa",
        code: "MAIN",
        status: "active",
        isOpen: false,
      });

      await expect(
        branchService.assertBranchOperational(branch._id)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Chi nhánh đang đóng cửa",
      });
    });

    it("throws 403 when parent merchant is suspended", async () => {
      const merchant = await Merchant.create({
        name: "Merchant Bị Đình Chỉ",
        slug: "merchant-bi-dinh-chi",
        ownerUserId: new mongoose.Types.ObjectId(),
        status: "suspended",
      });

      const branch = await Branch.create({
        merchantId: merchant._id,
        name: "Chi nhánh của merchant treo",
        code: "MAIN",
        status: "active",
        isOpen: true,
      });

      await expect(
        branchService.assertBranchOperational(branch._id)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Thương hiệu chưa được duyệt hoặc đã bị đình chỉ",
      });
    });
  });
});
