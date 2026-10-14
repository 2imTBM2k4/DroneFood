import { describe, expect, it } from "vitest";
import { Order } from "../../models/index.cjs";

describe("Order Code Generator & Format", () => {
  it("generates orderCode following format <DD><MM><YY>-<9 digits>", () => {
    const testDate = new Date("2026-10-12T15:30:00+07:00");
    const code = Order.generateOrderCode(testDate);

    // Should start with 121026-
    expect(code).toMatch(/^121026-\d{9}$/);

    const [datePart, randomPart] = code.split("-");
    expect(datePart).toBe("121026");
    expect(randomPart).toHaveLength(9);
    expect(Number(randomPart)).toBeGreaterThanOrEqual(100000000);
    expect(Number(randomPart)).toBeLessThan(1000000000);
  });

  it("pads single digit days and months with 0", () => {
    const testDate = new Date("2026-03-05T08:00:00+07:00");
    const code = Order.generateOrderCode(testDate);

    // Day 05, Month 03, Year 26
    expect(code).toMatch(/^050326-\d{9}$/);
  });

  it("handles end of year correctly", () => {
    const testDate = new Date("2027-12-31T23:59:59+07:00");
    const code = Order.generateOrderCode(testDate);

    // Day 31, Month 12, Year 27
    expect(code).toMatch(/^311227-\d{9}$/);
  });

  it("automatically assigns orderCode via pre-validate hook on new Order", () => {
    const order = new Order({
      totalPrice: 50000,
      paymentMethod: "COD",
    });

    order.validateSync();
    expect(order.orderCode).toBeDefined();
    expect(order.orderCode).toMatch(/^\d{6}-\d{9}$/);
  });

  it("preserves explicitly provided orderCode", () => {
    const customCode = "121026-999888777";
    const order = new Order({
      orderCode: customCode,
      totalPrice: 50000,
      paymentMethod: "COD",
    });

    order.validateSync();
    expect(order.orderCode).toBe(customCode);
  });
});
