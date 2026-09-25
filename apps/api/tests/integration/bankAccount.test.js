import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Restaurant, RestaurantWithdrawal, ShipperProfile } from "../../models/index.cjs";
import { createAdmin, createRestaurantOwner, createUser, generateToken } from "../helpers.js";

const accountPayload = {
  bankName: "Ngân hàng TMCP Ngoại thương Việt Nam",
  accountHolder: "NGUYEN VAN A",
  accountNumber: "1234 5678 9012",
};

describe("Bank account profile", () => {
  it("stores a restaurant account encrypted and only returns the masked number", async () => {
    const { owner, restaurant } = await createRestaurantOwner();
    const token = generateToken(owner._id);

    const updated = await request(app)
      .put("/api/restaurant/me/bank-account")
      .set("Authorization", `Bearer ${token}`)
      .send(accountPayload);

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      bankName: accountPayload.bankName,
      accountHolder: accountPayload.accountHolder,
      accountNumberMasked: "•••• 9012",
      isConfigured: true,
    });
    expect(JSON.stringify(updated.body)).not.toContain("123456789012");

    const stored = await Restaurant.findById(restaurant._id).select("+bankAccountEncrypted");
    expect(stored.bankAccountEncrypted).toBeTruthy();
    expect(stored.bankAccountEncrypted).not.toContain("123456789012");

    const fetched = await request(app)
      .get("/api/restaurant/me/bank-account")
      .set("Authorization", `Bearer ${token}`);
    expect(fetched.body.data.accountNumberMasked).toBe("•••• 9012");

    const storefront = await request(app).get("/api/restaurant/list");
    expect(JSON.stringify(storefront.body)).not.toContain(accountPayload.accountHolder);
    expect(JSON.stringify(storefront.body)).not.toContain("9012");
  });

  it("keeps a shipper account out of the normal profile response", async () => {
    const shipper = await createUser({ role: "shipper" });
    await ShipperProfile.create({ user: shipper._id, vehicleType: "motorbike" });
    const token = generateToken(shipper._id);

    const updated = await request(app)
      .put("/api/shippers/me/bank-account")
      .set("Authorization", `Bearer ${token}`)
      .send(accountPayload);
    expect(updated.status).toBe(200);
    expect(updated.body.data.accountNumberMasked).toBe("•••• 9012");

    const profile = await request(app).get("/api/shippers/me").set("Authorization", `Bearer ${token}`);
    expect(JSON.stringify(profile.body)).not.toContain("123456789012");
    expect(profile.body.data.bankAccount.accountNumberLast4).toBe("9012");

    const stored = await ShipperProfile.findOne({ user: shipper._id }).select("+bankAccountEncrypted");
    expect(stored.bankAccountEncrypted).toBeTruthy();
  });

  it("freezes the restaurant payout account when the withdrawal is requested", async () => {
    const { owner, restaurant } = await createRestaurantOwner();
    restaurant.balance = 500000;
    await restaurant.save();
    const token = generateToken(owner._id);

    await request(app).put("/api/restaurant/me/bank-account")
      .set("Authorization", `Bearer ${token}`)
      .send(accountPayload)
      .expect(200);

    const created = await request(app).post("/api/restaurant-withdrawals")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 500000 });
    expect(created.status).toBe(200);
    expect(created.body.data.bankAccountSnapshot).toMatchObject({
      bankName: accountPayload.bankName,
      accountHolder: accountPayload.accountHolder,
      accountNumberLast4: "9012",
    });
    expect(JSON.stringify(created.body)).not.toContain("bankAccountSnapshotEncrypted");
    expect(JSON.stringify(created.body)).not.toContain("123456789012");

    await request(app).put("/api/restaurant/me/bank-account")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...accountPayload, bankName: "MB Bank", accountNumber: "987654321234" })
      .expect(200);

    const stored = await RestaurantWithdrawal.findById(created.body.data._id)
      .select("+bankAccountSnapshotEncrypted");
    expect(stored.bankAccountSnapshot).toMatchObject({
      bankName: accountPayload.bankName,
      accountHolder: accountPayload.accountHolder,
      accountNumberLast4: "9012",
    });
    expect(stored.bankAccountSnapshotEncrypted).toBeTruthy();
    expect(stored.bankAccountSnapshotEncrypted).not.toContain("123456789012");

    const admin = await createAdmin();
    await request(app).post(`/api/withdrawals/${created.body.data._id}/approve`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({})
      .expect(200);
    const payoutDetails = await request(app).get(`/api/withdrawals/${created.body.data._id}/payout-details`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`);
    expect(payoutDetails.status).toBe(200);
    expect(payoutDetails.headers["cache-control"]).toContain("no-store");
    expect(payoutDetails.body.data).toMatchObject({
      bankName: accountPayload.bankName,
      accountHolder: accountPayload.accountHolder,
      accountNumber: "123456789012",
      accountNumberMasked: "•••• 9012",
    });
  });
});
