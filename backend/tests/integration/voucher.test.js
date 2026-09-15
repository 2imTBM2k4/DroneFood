import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Voucher } from "../../models/index.cjs";
import * as voucherService from "../../services/voucherService.js";
import { createAdmin, createUser, generateToken } from "../helpers.js";

const voucherPayload = (overrides = {}) => ({
  code: "WELCOME10",
  kind: "percent",
  value: 10,
  appliesTo: "items_subtotal",
  minOrderAmount: 50000,
  maxDiscountAmount: 20000,
  startsAt: new Date(Date.now() - 60_000).toISOString(),
  endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  totalQuota: 20,
  perUserQuota: 2,
  enabled: true,
  ...overrides,
});

describe("Voucher API", () => {
  it("allows only an admin to create and list global vouchers", async () => {
    const admin = await createAdmin();
    const user = await createUser();
    const payload = voucherPayload();

    const blocked = await request(app).post("/api/vouchers").send(payload);
    expect(blocked.status).toBe(401);

    const forbidden = await request(app)
      .post("/api/vouchers")
      .set("Authorization", `Bearer ${generateToken(user._id)}`)
      .send(payload);
    expect(forbidden.status).toBe(403);

    const created = await request(app)
      .post("/api/vouchers")
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send(payload);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ code: "WELCOME10", usageCount: 0, enabled: true });

    const listed = await request(app)
      .get("/api/vouchers")
      .set("Authorization", `Bearer ${generateToken(admin._id)}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
  });

  it("updates enabled status and rejects a duplicate code", async () => {
    const admin = await createAdmin();
    const token = generateToken(admin._id);
    const first = await request(app).post("/api/vouchers").set("Authorization", `Bearer ${token}`).send(voucherPayload());
    const voucherId = first.body.data.id;

    const disabled = await request(app)
      .patch(`/api/vouchers/${voucherId}/enabled`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.enabled).toBe(false);

    const duplicate = await request(app)
      .post("/api/vouchers")
      .set("Authorization", `Bearer ${token}`)
      .send(voucherPayload({ code: "welcome10" }));
    expect(duplicate.status).toBe(409);
  });
});

describe("Voucher validation", () => {
  it("caps a percentage discount and refuses a shipping voucher with zero fee", async () => {
    const admin = await createAdmin();
    const customer = await createUser();
    await Voucher.create({ ...voucherPayload({ code: "CAP20", value: 20, maxDiscountAmount: 15000 }), createdBy: admin._id });
    await Voucher.create({
      ...voucherPayload({ code: "SHIP10", appliesTo: "shipping_fee", minOrderAmount: 0 }),
      createdBy: admin._id,
    });

    const capped = await voucherService.validateVoucherForOrder({
      code: "cap20",
      userId: customer._id,
      itemsPrice: 200000,
      shippingPrice: 10000,
    });
    expect(capped.discountAmount).toBe(15000);

    await expect(voucherService.validateVoucherForOrder({
      code: "SHIP10",
      userId: customer._id,
      itemsPrice: 50000,
      shippingPrice: 0,
    })).rejects.toMatchObject({ statusCode: 409 });
  });
});
