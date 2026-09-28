import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const checkoutSourceUrl = new URL(
  "../src/screens/checkout/CheckoutScreen.tsx",
  import.meta.url,
);

test("checkout keeps the requested mobile section order", async () => {
  const source = await readFile(checkoutSourceUrl, "utf8");
  const sectionTitles = [
    "Tóm tắt đơn hàng",
    "Địa chỉ giao hàng",
    "Phương thức giao hàng",
    "Phương thức thanh toán",
    "Mã ưu đãi",
  ];
  const positions = sectionTitles.map((title) => source.indexOf(`>${title}<`));

  assert.ok(positions.every((position) => position >= 0), "All checkout sections should be present");
  assert.deepEqual(
    positions,
    [...positions].sort((left, right) => left - right),
    "Checkout sections should follow the product-defined order",
  );
});

test("checkout submit action stays outside the scrolling content", async () => {
  const source = await readFile(checkoutSourceUrl, "utf8");
  const scrollEnd = source.indexOf("</ScrollView>");
  const footerStart = source.indexOf("<View style={styles.checkoutFooter}>");
  const submitButton = source.indexOf("Đặt đơn hàng ngay", footerStart);

  assert.ok(scrollEnd >= 0 && footerStart > scrollEnd, "Checkout footer should render after ScrollView");
  assert.ok(submitButton > footerStart, "The submit button should render inside the persistent footer");
  assert.match(source, /style=\{styles\.scroll\}/, "The ScrollView should flex around the persistent footer");
});

test("checkout summary leaves the payable total on the persistent submit button", async () => {
  const source = await readFile(checkoutSourceUrl, "utf8");
  const summaryStart = source.indexOf("{/* Order Summary */}");
  const summaryEnd = source.indexOf("{/* Delivery Address Section */}", summaryStart);
  const summarySource = source.slice(summaryStart, summaryEnd);

  assert.doesNotMatch(summarySource, /Tổng thanh toán/);
  assert.match(source, /Đặt đơn hàng ngay • \$\{formatVnd\(total\)\}/);
});

test("checkout uses an in-app top toast for item deletion confirmation", async () => {
  const source = await readFile(checkoutSourceUrl, "utf8");

  assert.doesNotMatch(source, /Alert\.alert\("Xóa món"/);
  assert.match(source, /showToast\(\{[\s\S]*title: "Xóa món\?"[\s\S]*secondaryAction: \{ label: "Giữ lại" \}[\s\S]*destructive: true/);
});
