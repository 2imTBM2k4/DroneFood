import { Food, Order, Restaurant, User } from "../../models/index.cjs";
import { createFood, createOrder, createRestaurantOwner, createUser } from "../helpers.js";

describe("test factories", () => {
  it("creates a valid linked user, restaurant, food, and order", async () => {
    const customer = await createUser();
    const { restaurant, owner } = await createRestaurantOwner();
    const food = await createFood(restaurant._id);
    const order = await createOrder(customer._id, restaurant._id);

    expect(await User.exists({ _id: customer._id })).toBeTruthy();
    expect(await Restaurant.exists({ _id: restaurant._id, owner: owner._id })).toBeTruthy();
    expect(await Food.exists({ _id: food._id, restaurantId: restaurant._id })).toBeTruthy();
    expect(await Order.exists({ _id: order._id, user: customer._id, restaurantId: restaurant._id })).toBeTruthy();
    expect(String(order.orderItems[0].product)).not.toBe("");
  });
});
