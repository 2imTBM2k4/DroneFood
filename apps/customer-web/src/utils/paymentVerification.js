/** Rejects abandoned payment checks even when a transport ignores cancellation. */
const assertActive = (signal) => {
  if (signal?.aborted) throw new DOMException("Payment check cancelled", "AbortError");
};

/** Waits between checks and releases the timer when the page is left. */
const waitForNextCheck = (milliseconds, signal) => new Promise((resolve, reject) => {
  assertActive(signal);
  const onAbort = () => {
    clearTimeout(timer);
    reject(new DOMException("Payment check cancelled", "AbortError"));
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener("abort", onAbort);
    resolve();
  }, milliseconds);
  signal?.addEventListener("abort", onAbort, { once: true });
});

/** Checks server-confirmed payment once, or polls for a bounded number of attempts. */
export const verifyPaymentStatus = async ({ api, orderId, signal, attempts = 1, intervalMs = 1500, wait = waitForNextCheck }) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    assertActive(signal);
    const { data } = await api.post("/api/order/verify", { orderId }, { signal, timeout: 12000 });
    assertActive(signal);
    if (data.success || data.code === "PAYMENT_CHECK_UNAVAILABLE" || attempt === attempts - 1) return data;
    await wait(intervalMs, signal);
  }
};
