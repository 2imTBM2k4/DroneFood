import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import requireMerchantAccess from "../../middleware/requireMerchantAccess.cjs";
import { Merchant } from "../../models/index.cjs";

const createMockReq = (overrides = {}) => ({
  params: {},
  body: {},
  query: {},
  ...overrides,
});

describe("requireMerchantAccess middleware", () => {
  it("rejects with 401 when req.user is missing", async () => {
    const req = createMockReq();
    let caughtError = null;
    const next = (err) => {
      caughtError = err;
    };

    await requireMerchantAccess(req, {}, next);
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(401);
  });

  it("rejects with 400 when merchantId is missing", async () => {
    const req = createMockReq({ user: { _id: new mongoose.Types.ObjectId(), role: "merchant_owner" } });
    let caughtError = null;
    const next = (err) => {
      caughtError = err;
    };

    await requireMerchantAccess(req, {}, next);
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(400);
    expect(caughtError.message).toContain("merchantId là bắt buộc");
  });

  it("rejects with 400 when merchantId is not a valid ObjectId", async () => {
    const req = createMockReq({
      user: { _id: new mongoose.Types.ObjectId(), role: "merchant_owner" },
      params: { merchantId: "invalid-id" },
    });
    let caughtError = null;
    const next = (err) => {
      caughtError = err;
    };

    await requireMerchantAccess(req, {}, next);
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(400);
    expect(caughtError.message).toContain("merchantId không hợp lệ");
  });

  it("rejects with 404 when merchant does not exist", async () => {
    const req = createMockReq({
      user: { _id: new mongoose.Types.ObjectId(), role: "merchant_owner" },
      params: { merchantId: new mongoose.Types.ObjectId().toString() },
    });
    let caughtError = null;
    const next = (err) => {
      caughtError = err;
    };

    await requireMerchantAccess(req, {}, next);
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(404);
  });

  it("allows admin and attaches req.merchant", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const merchant = await Merchant.create({
      name: "Trà Sữa Admin",
      slug: "tra-sua-admin",
      ownerUserId: ownerId,
      status: "active",
      type: "individual",
    });

    const req = createMockReq({
      user: { _id: new mongoose.Types.ObjectId(), role: "admin" },
      params: { id: merchant._id.toString() },
    });

    let calledWithoutError = false;
    const next = (err) => {
      if (!err) calledWithoutError = true;
    };

    await requireMerchantAccess(req, {}, next);
    expect(calledWithoutError).toBe(true);
    expect(req.merchant).toBeDefined();
    expect(req.merchant._id.toString()).toBe(merchant._id.toString());
  });

  it("allows merchant owner and attaches req.merchant", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const merchant = await Merchant.create({
      name: "Bún Bò Owner",
      slug: "bun-bo-owner",
      ownerUserId: ownerId,
      status: "active",
      type: "individual",
    });

    const req = createMockReq({
      user: { _id: ownerId, role: "merchant_owner" },
      body: { merchantId: merchant._id.toString() },
    });

    let calledWithoutError = false;
    const next = (err) => {
      if (!err) calledWithoutError = true;
    };

    await requireMerchantAccess(req, {}, next);
    expect(calledWithoutError).toBe(true);
    expect(req.merchant).toBeDefined();
    expect(req.merchant._id.toString()).toBe(merchant._id.toString());
  });

  it("rejects non-owner user with 403", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const merchant = await Merchant.create({
      name: "Phở Gia Truyền",
      slug: "pho-gia-truyen",
      ownerUserId: ownerId,
      status: "active",
      type: "individual",
    });

    const req = createMockReq({
      user: { _id: otherUserId, role: "merchant_owner" },
      query: { merchantId: merchant._id.toString() },
    });

    let caughtError = null;
    const next = (err) => {
      caughtError = err;
    };

    await requireMerchantAccess(req, {}, next);
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(403);
    expect(caughtError.message).toContain("Bạn không có quyền quản lý merchant này");
  });
});
