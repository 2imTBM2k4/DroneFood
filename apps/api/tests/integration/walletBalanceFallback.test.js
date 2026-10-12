import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Merchant, Restaurant, User } from "../../models/index.cjs";
import { createRestaurantOwner, createUser, generateToken } from "../helpers.js";
import * as walletService from "../../services/walletService.js";

const LEGACY_BALANCE = 20518630;

/**
 * Mirrors production after the multi-branch migration: owner role becomes
 * merchant_owner and the merchant reuses the restaurant _id without `balance`.
 */
const createMigratedOwner = async ({ restaurantBalance = LEGACY_BALANCE } = {}) => {
  const { owner, restaurant } = await createRestaurantOwner();
  await Restaurant.updateOne({ _id: restaurant._id }, { $set: { balance: restaurantBalance } });
  await User.updateOne({ _id: owner._id }, { $set: { role: "merchant_owner" } });
  const merchant = await Merchant.create({
    _id: restaurant._id,
    legacyRestaurantId: restaurant._id,
    name: restaurant.name,
    slug: `merchant-${restaurant._id}`,
    ownerUserId: owner._id,
    status: "active",
  });
  return { owner, restaurant, merchant, token: generateToken(owner._id) };
};

const getBalance = (token) => request(app)
  .get("/api/restaurant-withdrawals/balance")
  .set("Authorization", `Bearer ${token}`);

describe("Restaurant wallet balance fallback (merchant -> legacy restaurant)", () => {
  it("prefers restaurant.balance when both merchant and restaurant documents have balances", async () => {
    const { merchant, token } = await createMigratedOwner({ restaurantBalance: 5000000 });
    // Write a different balance on the merchant to verify restaurant.balance is preferred
    await Merchant.collection.updateOne({ _id: merchant._id }, { $set: { balance: 1000000 } });

    const res = await getBalance(token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.balance).toBe(5000000);
  });

  it("uses merchant.balance when merchant has balance and restaurant does not exist", async () => {
    const { merchant, restaurant, token } = await createMigratedOwner();
    await Merchant.collection.updateOne({ _id: merchant._id }, { $set: { balance: 1234567 } });
    await Restaurant.deleteOne({ _id: restaurant._id });

    const res = await getBalance(token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.balance).toBe(1234567);
  });

  it("falls back to the legacy restaurant balance for a merchant_owner", async () => {
    const { token } = await createMigratedOwner();

    const res = await getBalance(token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      balance: LEGACY_BALANCE,
      reservedWithdrawalAmount: 0,
      availableBalance: LEGACY_BALANCE,
    });
  });

  it("subtracts reserved withdrawals from availableBalance", async () => {
    const { restaurant, token } = await createMigratedOwner();
    await Restaurant.updateOne({ _id: restaurant._id }, { $set: { reservedWithdrawalAmount: 518630 } });

    const res = await getBalance(token);
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(LEGACY_BALANCE);
    expect(res.body.data.reservedWithdrawalAmount).toBe(518630);
    expect(res.body.data.availableBalance).toBe(20000000);
  });

  it("returns 0 when neither merchant nor restaurant has a balance", async () => {
    const { restaurant, token } = await createMigratedOwner();
    await Restaurant.collection.updateOne({ _id: restaurant._id }, { $unset: { balance: "" } });

    const res = await getBalance(token);
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(0);
    expect(res.body.data.availableBalance).toBe(0);
  });

  it("keeps working for a legacy restaurant_owner without a merchant", async () => {
    const { owner, restaurant } = await createRestaurantOwner();
    await Restaurant.updateOne({ _id: restaurant._id }, { $set: { balance: 750000 } });

    const res = await getBalance(generateToken(owner._id));
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(750000);
  });

  it("rejects a plain user with 403", async () => {
    const user = await createUser({ role: "user" });
    const res = await getBalance(generateToken(user._id));
    expect(res.status).toBe(403);
  });

  it("getMerchantBalance throws 404 for an unknown merchant", async () => {
    await expect(walletService.getMerchantBalance("68ff3e6a8bb000399eba5b4c"))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
