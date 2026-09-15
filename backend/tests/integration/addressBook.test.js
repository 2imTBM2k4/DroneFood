import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Order } from "../../models/index.cjs";
import { createFood, createRestaurantOwner, createUser, generateToken } from "../helpers.js";

const address = (overrides = {}) => ({
  label: "Nhà", recipient: "Nguyễn An", phone: "0901234567", address: "1 Nguyễn Huệ", city: "Hồ Chí Minh", state: "Hồ Chí Minh", country: "Việt Nam", zipCode: "70000", lat: 10.7769, lng: 106.7009,
  ...overrides,
});

describe("Address book API", () => {
  it("creates a first default address, changes default and isolates owners", async () => {
    const user = await createUser();
    const stranger = await createUser();
    const token = generateToken(user._id);
    const first = await request(app).post("/api/address-book").set("Authorization", `Bearer ${token}`).send(address());
    const second = await request(app).post("/api/address-book").set("Authorization", `Bearer ${token}`).send(address({ label: "Công ty", address: "2 Lê Lợi" }));
    expect(first.status).toBe(201);
    expect(first.body.data.isDefault).toBe(true);
    expect(second.body.data.isDefault).toBe(false);

    const changed = await request(app).put(`/api/address-book/${second.body.data.id}/default`).set("Authorization", `Bearer ${token}`);
    expect(changed.status).toBe(200);
    expect(changed.body.data.filter((entry) => entry.isDefault).map((entry) => entry.id)).toEqual([second.body.data.id]);

    const foreign = await request(app).patch(`/api/address-book/${second.body.data.id}`).set("Authorization", `Bearer ${generateToken(stranger._id)}`).send({ label: "Stolen" });
    expect(foreign.status).toBe(404);
  });

  it("protects the default entry and snapshots a selected address into an order", async () => {
    const { restaurant } = await createRestaurantOwner();
    const user = await createUser();
    const token = generateToken(user._id);
    const saved = await request(app).post("/api/address-book").set("Authorization", `Bearer ${token}`).send(address({ label: "Văn phòng", recipient: "Trần Bình", address: "3 Pasteur" }));
    const entryId = saved.body.data.id;

    const blocked = await request(app).delete(`/api/address-book/${entryId}`).set("Authorization", `Bearer ${token}`);
    expect(blocked.status).toBe(409);

    const food = await createFood(restaurant._id);
    await request(app).post("/api/cart/add").set("Authorization", `Bearer ${token}`).send({ itemId: food._id.toString() });
    const placed = await request(app).post("/api/order/place").set("Authorization", `Bearer ${token}`).send({ addressEntryId: entryId, paymentMethod: "COD", deliveryMethod: "shipper" });
    expect(placed.status).toBe(200);

    const order = await Order.findById(placed.body.orderId);
    expect(order.shippingAddress).toMatchObject({ fullName: "Test User", address: "3 Pasteur", phone: "0901234567" });

    await request(app).patch(`/api/address-book/${entryId}`).set("Authorization", `Bearer ${token}`).send({ recipient: "Tên mới" });
    const unchanged = await Order.findById(placed.body.orderId);
    expect(unchanged.shippingAddress.fullName).toBe("Test User");
  });
});
