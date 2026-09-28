import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const toastSourceUrl = new URL(
  "../src/components/common/ToastProvider.tsx",
  import.meta.url,
);

test("top toast is brief, accessible, and supports explicit confirmation actions", async () => {
  const source = await readFile(toastSourceUrl, "utf8");

  assert.match(source, /accessibilityLiveRegion="polite"/);
  assert.match(source, /accessibilityRole="alert"/);
  assert.match(source, /toast\.primaryAction \|\| toast\.secondaryAction \? 6500 : 3500/);
  assert.match(source, /minHeight: 44/);
  assert.match(source, /destructive \? colors\.danger : colors\.primary/);
  assert.match(source, /current\?\.id === hidingToastId \? null : current/);
});

test("customer mobile feedback no longer uses native system alerts", async () => {
  const sourceUrls = [
    new URL("../App.tsx", import.meta.url),
    new URL("../src/components/address/AddressBookModal.tsx", import.meta.url),
    new URL("../src/components/address/AddressEditorModal.tsx", import.meta.url),
    new URL("../src/components/food/OptionGroupModal.tsx", import.meta.url),
    new URL("../src/components/orders/OrderReviewModal.tsx", import.meta.url),
    new URL("../src/screens/cart/CartScreen.tsx", import.meta.url),
    new URL("../src/screens/checkout/CheckoutScreen.tsx", import.meta.url),
    new URL("../src/screens/orders/DroneTrackingScreen.tsx", import.meta.url),
    new URL("../src/screens/profile/ProfileScreen.tsx", import.meta.url),
  ];

  for (const sourceUrl of sourceUrls) {
    const source = await readFile(sourceUrl, "utf8");
    assert.doesNotMatch(source, /Alert\.alert\s*\(/, sourceUrl.pathname);
  }
});

test("destructive confirmations stay explicit through actionable toasts", async () => {
  const [addressBook, cart, profile] = await Promise.all([
    readFile(new URL("../src/components/address/AddressBookModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/screens/cart/CartScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/screens/profile/ProfileScreen.tsx", import.meta.url), "utf8"),
  ]);

  for (const source of [addressBook, cart, profile]) {
    assert.match(source, /secondaryAction:/);
    assert.match(source, /primaryAction:/);
    assert.match(source, /destructive: true/);
  }
});
