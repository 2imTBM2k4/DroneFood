import { describe, expect, it, vi } from "vitest";
import { Voucher, Restaurant, Cart, Food } from "../../models/index.cjs";
import * as voucherService from "../../services/voucherService.js";
import * as orderService from "../../services/orderService.js";
import { isRestaurantOpenNow } from "../../utils/openingHours.js";
import { createAdmin, createUser, createRestaurantOwner } from "../helpers.js";

const sampleVoucher = (overrides = {}) => ({
  code: "FOOD10",
  kind: "percent",
  value: 10,
  appliesTo: "items_subtotal",
  minOrderAmount: 50000,
  maxDiscountAmount: 30000,
  startsAt: new Date(Date.now() - 60_000),
  endsAt: new Date(Date.now() + 60 * 60 * 1000),
  totalQuota: 50,
  perUserQuota: 5,
  enabled: true,
  ...overrides,
});

describe("Restaurant openingHours and isOpenNow logic", () => {
  it("determines open/close state based on openingHours and isOpen flag", () => {
    // Normal day hours: 07:00 to 22:00
    const normalRestaurant = {
      isOpen: true,
      isLocked: false,
      openingHours: { openTime: "07:00", closeTime: "22:00" },
    };

    // 10:00 AM VN time
    const morningDate = new Date("2026-09-17T03:00:00.000Z"); // 03:00 UTC = 10:00 UTC+7
    expect(isRestaurantOpenNow(normalRestaurant, morningDate)).toBe(true);

    // 23:30 VN time
    const lateNightDate = new Date("2026-09-17T16:30:00.000Z"); // 16:30 UTC = 23:30 UTC+7
    expect(isRestaurantOpenNow(normalRestaurant, lateNightDate)).toBe(false);

    // Closed manually by owner
    expect(isRestaurantOpenNow({ ...normalRestaurant, isOpen: false }, morningDate)).toBe(false);

    // Locked by admin
    expect(isRestaurantOpenNow({ ...normalRestaurant, isLocked: true }, morningDate)).toBe(false);

    // Overnight schedule: 18:00 to 02:00
    const overnightRestaurant = {
      isOpen: true,
      isLocked: false,
      openingHours: { openTime: "18:00", closeTime: "02:00" },
    };
    // 20:00 VN time (13:00 UTC) -> should be open
    const eveningDate = new Date("2026-09-17T13:00:00.000Z");
    expect(isRestaurantOpenNow(overnightRestaurant, eveningDate)).toBe(true);

    // 01:00 VN time (18:00 UTC previous day) -> should be open
    const midnightDate = new Date("2026-09-17T18:00:00.000Z");
    expect(isRestaurantOpenNow(overnightRestaurant, midnightDate)).toBe(true);

    // 10:00 VN time -> should be closed for overnight restaurant
    expect(isRestaurantOpenNow(overnightRestaurant, morningDate)).toBe(false);
  });
});

describe("Multi-voucher Stacking & Validation", () => {
  it("allows stacking 1 items_subtotal voucher and 1 shipping_fee voucher", async () => {
    const admin = await createAdmin();
    const customer = await createUser();

    await Voucher.create(sampleVoucher({
      code: "ITEMS10",
      appliesTo: "items_subtotal",
      kind: "percent",
      value: 10,
      maxDiscountAmount: 50000,
      createdBy: admin._id,
    }));

    await Voucher.create(sampleVoucher({
      code: "SHIPFREE",
      appliesTo: "shipping_fee",
      kind: "fixed",
      value: 15000,
      minOrderAmount: 0,
      createdBy: admin._id,
    }));

    const result = await voucherService.validateVouchersForOrder({
      codes: ["ITEMS10", "SHIPFREE"],
      userId: customer._id,
      itemsPrice: 100000,
      shippingPrice: 20000,
    });

    expect(result.applications).toHaveLength(2);
    expect(result.totalDiscountAmount).toBe(10000 + 15000); // 10k items + 15k ship
    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[0].code).toBe("ITEMS10");
    expect(result.snapshots[1].code).toBe("SHIPFREE");
  });

  it("rejects stacking two vouchers of the same appliesTo type", async () => {
    const admin = await createAdmin();
    const customer = await createUser();

    await Voucher.create(sampleVoucher({
      code: "FOOD1",
      appliesTo: "items_subtotal",
      kind: "fixed",
      value: 10000,
      createdBy: admin._id,
    }));

    await Voucher.create(sampleVoucher({
      code: "FOOD2",
      appliesTo: "items_subtotal",
      kind: "fixed",
      value: 20000,
      createdBy: admin._id,
    }));

    await expect(
      voucherService.validateVouchersForOrder({
        codes: ["FOOD1", "FOOD2"],
        userId: customer._id,
        itemsPrice: 100000,
        shippingPrice: 20000,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects duplicate voucher codes in stack", async () => {
    const customer = await createUser();

    await expect(
      voucherService.validateVouchersForOrder({
        codes: ["DUP10", "DUP10"],
        userId: customer._id,
        itemsPrice: 100000,
        shippingPrice: 20000,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("places order with multi-vouchers, reserves all, and releases all when cancelled", async () => {
    process.env.TRACKASIA_KEY = "test-key";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ distances: [[3000]] }), // 3km -> 15,000 VND shipping fee
    });

    try {
      const admin = await createAdmin();
      const customer = await createUser();
      const { owner } = await createRestaurantOwner();

      const restaurant = await Restaurant.create({
        name: "Bếp Việt MultiVoucher",
        address: "10 Đường Mới, Quận 1",
        email: `vietmv_${Date.now()}@test.com`,
        owner: owner._id,
        lat: 10.7769,
        lng: 106.7008,
        isOpen: true,
        isLocked: false,
        openingHours: { openTime: "00:00", closeTime: "23:59" },
      });

      const food = await Food.create({
        name: "Phở Bò Đặc Biệt",
        description: "Thơm ngon",
        price: 100000,
        image: "pho.jpg",
        category: "Món nước",
        restaurantId: restaurant._id,
      });

      await Cart.create({
        userId: customer._id,
        items: [{ lineKey: String(food._id), foodId: food._id, quantity: 1 }],
      });

      const voucherFood = await Voucher.create(sampleVoucher({
        code: "MVFOOD",
        appliesTo: "items_subtotal",
        kind: "fixed",
        value: 20000,
        totalQuota: 5,
        usageCount: 0,
        createdBy: admin._id,
      }));

      const voucherShip = await Voucher.create(sampleVoucher({
        code: "MVSHIP",
        appliesTo: "shipping_fee",
        kind: "fixed",
        value: 10000,
        minOrderAmount: 0,
        totalQuota: 5,
        usageCount: 0,
        createdBy: admin._id,
      }));

      const orderData = {
        address: {
          fullName: "Nguyễn Văn Test",
          address: "200 Lê Lợi, Bến Nghé",
          city: "TP Hồ Chí Minh",
          state: "TP Hồ Chí Minh",
          country: "Việt Nam",
          phone: "0901234567",
          lat: 10.7800,
          lng: 106.7100,
        },
        paymentMethod: "COD",
        deliveryMethod: "shipper",
        voucherCodes: ["MVFOOD", "MVSHIP"],
      };

      const result = await orderService.placeOrder(customer, orderData, "127.0.0.1");
      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();

      // Verify usageCount incremented for both vouchers
      const reloadedV1 = await Voucher.findById(voucherFood._id);
      const reloadedV2 = await Voucher.findById(voucherShip._id);
      expect(reloadedV1.usageCount).toBe(1);
      expect(reloadedV2.usageCount).toBe(1);

      // Cancel order and verify both vouchers are released
      await orderService.updateStatus(customer, {
        orderId: result.orderId,
        status: "cancelled",
        reason: "Đổi ý không mua nữa",
      });

      const releasedV1 = await Voucher.findById(voucherFood._id);
      const releasedV2 = await Voucher.findById(voucherShip._id);
      expect(releasedV1.usageCount).toBe(0);
      expect(releasedV2.usageCount).toBe(0);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
