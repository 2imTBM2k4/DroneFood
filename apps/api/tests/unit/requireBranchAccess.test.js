import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import requireBranchAccess from "../../middleware/requireBranchAccess.cjs";
import { Branch, Merchant } from "../../models/index.cjs";

const createMockReq = (overrides = {}) => ({
  params: {},
  body: {},
  query: {},
  ...overrides,
});

describe("requireBranchAccess middleware", () => {
  it("rejects with 401 when req.user is missing", async () => {
    const req = createMockReq();
    let caughtError = null;
    const next = (err) => {
      caughtError = err;
    };

    await requireBranchAccess(req, {}, next);
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(401);
  });

  it("rejects with 400 when branchId is missing", async () => {
    const req = createMockReq({ user: { _id: new mongoose.Types.ObjectId(), role: "branch_manager" } });
    let caughtError = null;
    const next = (err) => {
      caughtError = err;
    };

    await requireBranchAccess(req, {}, next);
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(400);
    expect(caughtError.message).toContain("branchId là bắt buộc");
  });

  it("rejects with 400 when branchId is invalid ObjectId", async () => {
    const req = createMockReq({
      user: { _id: new mongoose.Types.ObjectId(), role: "branch_manager" },
      params: { branchId: "bad-id" },
    });
    let caughtError = null;
    const next = (err) => {
      caughtError = err;
    };

    await requireBranchAccess(req, {}, next);
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(400);
    expect(caughtError.message).toContain("branchId không hợp lệ");
  });

  it("rejects with 404 when branch does not exist", async () => {
    const req = createMockReq({
      user: { _id: new mongoose.Types.ObjectId(), role: "branch_manager" },
      params: { branchId: new mongoose.Types.ObjectId().toString() },
    });
    let caughtError = null;
    const next = (err) => {
      caughtError = err;
    };

    await requireBranchAccess(req, {}, next);
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(404);
    expect(caughtError.message).toContain("Chi nhánh không tồn tại");
  });

  it("rejects with 404 when branch's merchant does not exist", async () => {
    const nonExistentMerchantId = new mongoose.Types.ObjectId();
    const branch = await Branch.create({
      merchantId: nonExistentMerchantId,
      name: "Chi nhánh mồ côi",
      code: "MAIN",
    });

    const req = createMockReq({
      user: { _id: new mongoose.Types.ObjectId(), role: "admin" },
      params: { id: branch._id.toString() },
    });

    let caughtError = null;
    const next = (err) => {
      caughtError = err;
    };

    await requireBranchAccess(req, {}, next);
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(404);
    expect(caughtError.message).toContain("Merchant của chi nhánh không tồn tại");
  });

  it("allows admin and attaches req.branch and req.merchant", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const merchant = await Merchant.create({
      name: "Cơm Tấm Admin",
      slug: "com-tam-admin",
      ownerUserId: ownerId,
      status: "active",
      type: "individual",
    });
    const branch = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh chính",
      code: "MAIN",
    });

    const req = createMockReq({
      user: { _id: new mongoose.Types.ObjectId(), role: "admin" },
      params: { branchId: branch._id.toString() },
    });

    let calledWithoutError = false;
    const next = (err) => {
      if (!err) calledWithoutError = true;
    };

    await requireBranchAccess(req, {}, next);
    expect(calledWithoutError).toBe(true);
    expect(req.branch).toBeDefined();
    expect(req.branch._id.toString()).toBe(branch._id.toString());
    expect(req.merchant).toBeDefined();
    expect(req.merchant._id.toString()).toBe(merchant._id.toString());
  });

  it("allows merchant owner and attaches req.branch and req.merchant", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const merchant = await Merchant.create({
      name: "Cơm Tấm Owner",
      slug: "com-tam-owner",
      ownerUserId: ownerId,
      status: "active",
      type: "individual",
    });
    const branch = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh 1",
      code: "CN1",
    });

    const req = createMockReq({
      user: { _id: ownerId, role: "merchant_owner" },
      body: { branchId: branch._id.toString() },
    });

    let calledWithoutError = false;
    const next = (err) => {
      if (!err) calledWithoutError = true;
    };

    await requireBranchAccess(req, {}, next);
    expect(calledWithoutError).toBe(true);
    expect(req.branch._id.toString()).toBe(branch._id.toString());
    expect(req.merchant._id.toString()).toBe(merchant._id.toString());
  });

  it("allows assigned branch manager and attaches req.branch and req.merchant", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const managerId = new mongoose.Types.ObjectId();
    const merchant = await Merchant.create({
      name: "Hủ Tiếu Manager",
      slug: "hu-tieu-manager",
      ownerUserId: ownerId,
      status: "active",
      type: "individual",
    });
    const branch = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh 2",
      code: "CN2",
      managerUserIds: [managerId],
    });

    const req = createMockReq({
      user: { _id: managerId, role: "branch_manager" },
      query: { branchId: branch._id.toString() },
    });

    let calledWithoutError = false;
    const next = (err) => {
      if (!err) calledWithoutError = true;
    };

    await requireBranchAccess(req, {}, next);
    expect(calledWithoutError).toBe(true);
    expect(req.branch._id.toString()).toBe(branch._id.toString());
    expect(req.merchant._id.toString()).toBe(merchant._id.toString());
  });

  it("rejects unauthorized user with 403", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const managerId = new mongoose.Types.ObjectId();
    const unauthorizedUserId = new mongoose.Types.ObjectId();

    const merchant = await Merchant.create({
      name: "Bánh Mì Test",
      slug: "banh-mi-test",
      ownerUserId: ownerId,
      status: "active",
      type: "individual",
    });
    const branch = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh 1",
      code: "MAIN",
      managerUserIds: [managerId],
    });

    const req = createMockReq({
      user: { _id: unauthorizedUserId, role: "branch_manager" },
      params: { branchId: branch._id.toString() },
    });

    let caughtError = null;
    const next = (err) => {
      caughtError = err;
    };

    await requireBranchAccess(req, {}, next);
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(403);
    expect(caughtError.message).toContain("Bạn không có quyền quản lý chi nhánh này");
  });
});
