import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../src/utils/paymentVerification.js", import.meta.url);
const verification = () => import(moduleUrl);

// Removing bounded polling or cancellation checks must break these tests.
test("confirms payment from the server and stops immediately", async () => {
  const { verifyPaymentStatus } = await verification();
  const calls = [];
  const api = { post: async (...args) => { calls.push(args); return { data: { success: true, code: "PAYMENT_CONFIRMED" } }; } };
  const result = await verifyPaymentStatus({ api, orderId: "order-1", attempts: 3 });
  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/api/order/verify");
  assert.deepEqual(calls[0][1], { orderId: "order-1" });
});

test("stops polling when a later response confirms payment", async () => {
  const { verifyPaymentStatus } = await verification();
  let calls = 0;
  let waits = 0;
  const result = await verifyPaymentStatus({
    api: { post: async () => { calls += 1; return { data: { success: calls === 2 } }; } },
    orderId: "order-1", attempts: 10, wait: async () => { waits += 1; },
  });
  assert.equal(result.success, true);
  assert.equal(calls, 2);
  assert.equal(waits, 1);
});

test("waits for confirmation but never exceeds the attempt limit", async () => {
  const { verifyPaymentStatus } = await verification();
  let calls = 0;
  let waits = 0;
  const api = { post: async () => { calls += 1; return { data: { success: false, code: "PAYMENT_PENDING" } }; } };
  const result = await verifyPaymentStatus({ api, orderId: "order-1", attempts: 3, wait: async () => { waits += 1; } });
  assert.equal(result.success, false);
  assert.equal(calls, 3);
  assert.equal(waits, 2);
});

test("a manual check makes one request without polling", async () => {
  const { verifyPaymentStatus } = await verification();
  let calls = 0;
  const result = await verifyPaymentStatus({ api: { post: async () => { calls += 1; return { data: { success: false } }; } }, orderId: "order-1" });
  assert.equal(result.success, false);
  assert.equal(calls, 1);
});

test("does not retry an unavailable provider in the same polling loop", async () => {
  const { verifyPaymentStatus } = await verification();
  let calls = 0;
  const result = await verifyPaymentStatus({ api: { post: async () => { calls += 1; return { data: { success: false, code: "PAYMENT_CHECK_UNAVAILABLE" } }; } }, orderId: "order-1", attempts: 3 });
  assert.equal(result.code, "PAYMENT_CHECK_UNAVAILABLE");
  assert.equal(calls, 1);
});

test("aborting before checking prevents any request", async () => {
  const { verifyPaymentStatus } = await verification();
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(verifyPaymentStatus({ api: { post: async () => { calls += 1; } }, orderId: "order-1", signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 0);
});

test("ignores an in-flight result after the page is left", async () => {
  const { verifyPaymentStatus } = await verification();
  const controller = new AbortController();
  const api = { post: async (_path, _body, options) => {
    assert.equal(options.signal, controller.signal);
    controller.abort();
    return { data: { success: true } };
  } };
  await assert.rejects(verifyPaymentStatus({ api, orderId: "order-1", signal: controller.signal }), { name: "AbortError" });
});

test("cancels the wait between attempts without another request", async () => {
  const { verifyPaymentStatus } = await verification();
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(verifyPaymentStatus({
    api: { post: async () => { calls += 1; return { data: { success: false } }; } },
    orderId: "order-1", attempts: 3, signal: controller.signal,
    wait: async () => { controller.abort(); },
  }), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("cancels the real delay promptly", { timeout: 1000 }, async () => {
  const { verifyPaymentStatus } = await verification();
  const controller = new AbortController();
  let calls = 0;
  const pending = verifyPaymentStatus({
    api: { post: async () => { calls += 1; return { data: { success: false } }; } },
    orderId: "order-1", attempts: 3, intervalMs: 10000, signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls, 1);
});

test("propagates authentication errors instead of treating them as unpaid", async () => {
  const { verifyPaymentStatus } = await verification();
  const error = Object.assign(new Error("Unauthorized"), { response: { status: 401 } });
  await assert.rejects(verifyPaymentStatus({ api: { post: async () => { throw error; } }, orderId: "order-1", attempts: 3 }), (received) => received === error);
});
