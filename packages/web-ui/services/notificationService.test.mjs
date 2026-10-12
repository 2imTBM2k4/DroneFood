import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createNotificationService,
  resolvePosition,
  DEFAULT_DURATIONS,
  DEFAULT_TITLES,
} from "./notificationService.js";
import {
  getNotificationAnalyticsMetrics,
  resetAnalyticsMetrics,
} from "./notificationAnalytics.js";

test("resolvePosition returns correct role-based position per NTF-007 and NTF-016", () => {
  // User -> bottom-right
  assert.equal(resolvePosition("user"), "bottom-right");
  // Restaurant -> top-right
  assert.equal(resolvePosition("restaurant"), "top-right");
  // Admin -> top-right
  assert.equal(resolvePosition("admin"), "top-right");
  // Fallback -> top-right
  assert.equal(resolvePosition(), "top-right");
  assert.equal(resolvePosition("unknown"), "top-right");
});

test("service sets default position and durations according to audience and type (NTF-005, NTF-007)", () => {
  const service = createNotificationService({ defaultAudience: "user" });

  let captured = null;
  service.setAdapter({
    show: (notif) => {
      captured = notif;
      return notif.id;
    },
    dismiss: () => {},
    clearAll: () => {},
  });

  // Test success
  service.success("Cập nhật thành công", "Thông tin đã được lưu.");
  assert.equal(captured.type, "success");
  assert.equal(captured.title, "Cập nhật thành công");
  assert.equal(captured.message, "Thông tin đã được lưu.");
  assert.equal(captured.position, "bottom-right");
  assert.equal(captured.duration, DEFAULT_DURATIONS.success); // 4000ms

  // Test warning duration (6-8s per NTF-005)
  service.warning("Cảnh báo", "Phiên đăng nhập sắp hết hạn.");
  assert.equal(captured.type, "warning");
  assert.equal(captured.duration, DEFAULT_DURATIONS.warning); // 6500ms
  assert.ok(captured.duration >= 6000 && captured.duration <= 8000);
});

test("service preserves third-argument options when notification has no message", () => {
  const service = createNotificationService({ defaultAudience: "admin" });
  let captured = null;
  service.setAdapter({
    show: (notification) => {
      captured = notification;
      return notification.id;
    },
    dismiss: () => {},
    clearAll: () => {},
  });

  service.success("Đã cập nhật hồ sơ", undefined, { audience: "user" });

  assert.equal(captured.audience, "user");
  assert.equal(captured.position, "bottom-right");
});

test("critical, persistent, duration=0, and error with action are truly persistent (NTF-005)", () => {
  const service = createNotificationService();
  let captured = null;
  service.setAdapter({
    show: (notif) => {
      captured = notif;
      return notif.id;
    },
    dismiss: () => {},
    clearAll: () => {},
  });

  // 1. Error with actions
  service.error("Lỗi mạng", "Vui lòng kiểm tra kết nối", {
    actions: [{ label: "Thử lại", onClick: () => {} }],
  });
  assert.equal(captured.persistent, true);
  assert.equal(captured.duration, false);

  // 2. Explicit duration=0
  service.error("Lỗi phần cứng", "Mô tơ drone quá nhiệt", {
    duration: 0,
  });
  assert.equal(captured.persistent, true);
  assert.equal(captured.duration, false);

  // 3. Priority=critical
  service.warning("Cảnh báo an toàn", "Pin drone dưới 10%", {
    priority: "critical",
  });
  assert.equal(captured.persistent, true);
  assert.equal(captured.duration, false);
});

// Case 1: Cùng key, cùng message, cùng type trong window -> Suppress (bỏ qua)
test("dedupe Case 1: same key, same message, same type within window is suppressed", () => {
  const service = createNotificationService({ dedupeWindowMs: 1500 });
  let showCount = 0;
  service.setAdapter({
    show: () => {
      showCount++;
      return "toast-id-1";
    },
    dismiss: () => {},
    clearAll: () => {},
  });

  const id1 = service.info("Thông báo hệ thống", "Đang kết nối lại...", { key: "sys-conn" });
  const id2 = service.info("Thông báo hệ thống", "Đang kết nối lại...", { key: "sys-conn" });

  assert.equal(showCount, 1);
  assert.equal(id1, id2);
});

// Case 2: Cùng key, khác message hoặc type trong window -> Update tại chỗ, reset timer
test("dedupe Case 2: same key but different message or type calls toastAdapter.update and resets timer", () => {
  const service = createNotificationService({ dedupeWindowMs: 2000 });
  let updateCalled = false;
  let updatedNotification = null;

  service.setAdapter({
    show: (notif) => notif.id,
    update: (id, notif) => {
      updateCalled = true;
      updatedNotification = notif;
    },
    dismiss: () => {},
    clearAll: () => {},
  });

  const id1 = service.info("Đang tải dữ liệu", "Tiến trình 20%", { key: "download-key" });
  const id2 = service.success("Đang tải dữ liệu", "Tiến trình 100% Hoàn tất", { key: "download-key" });

  assert.equal(id1, id2, "ID should remain the same for the active key");
  assert.equal(updateCalled, true, "Update adapter method should be called");
  assert.equal(updatedNotification.message, "Tiến trình 100% Hoàn tất");
  assert.equal(updatedNotification.type, "success");
});

// Case 3: Cùng key xuất hiện 3+ lần liên tiếp trong window -> Chỉ update, không tạo mới; window đếm từ lần gần nhất
test("dedupe Case 3: same key appears 3+ times consecutively in window - updates without creating new, window refreshes", () => {
  const service = createNotificationService({ dedupeWindowMs: 2000 });
  let createCount = 0;
  let updateCount = 0;

  service.setAdapter({
    show: (notif) => {
      createCount++;
      return notif.id;
    },
    update: () => {
      updateCount++;
    },
    dismiss: () => {},
    clearAll: () => {},
  });

  const id1 = service.info("Tiến trình", "Bước 1", { key: "multi-step" });
  const id2 = service.info("Tiến trình", "Bước 2", { key: "multi-step" });
  const id3 = service.info("Tiến trình", "Bước 3", { key: "multi-step" });
  const id4 = service.info("Tiến trình", "Bước 4", { key: "multi-step" });

  assert.equal(createCount, 1, "Only 1 initial toast should be created");
  assert.equal(updateCount, 3, "Subsequent 3 calls should update in-place");
  assert.equal(id1, id2);
  assert.equal(id2, id3);
  assert.equal(id3, id4);
});

// Case 4: Cùng key nhưng toast cũ đã auto-dismiss -> Tạo toast mới (không update toast đã chết)
test("dedupe Case 4: same key after old toast dismissed creates a new toast", () => {
  const service = createNotificationService({ dedupeWindowMs: 2000 });
  let showCount = 0;
  let lastCallback = null;

  service.setAdapter({
    show: (notif, cbs) => {
      showCount++;
      lastCallback = cbs;
      return notif.id;
    },
    update: () => {},
    dismiss: () => {},
    clearAll: () => {},
  });

  const id1 = service.info("Tải tài liệu", "Đang xử lý", { key: "doc-download" });
  assert.equal(showCount, 1);

  // Giả lập toast cũ auto-dismiss qua onClose callback
  lastCallback?.onClose();

  // Gọi lại cùng key sau khi toast cũ đã đóng
  const id2 = service.info("Tải tài liệu", "Tải lại tài liệu mới", { key: "doc-download" });
  assert.equal(showCount, 2, "Must create a brand new toast instead of updating the closed one");
  assert.notEqual(id1, id2, "New toast should receive a new ID");
});

test("dedupe Case 4 with duration in seconds: normalizes duration 5 to 5000ms and expires only after 5000ms", () => {
  const originalNow = Date.now;
  let simulatedTime = 1_000_000;
  Date.now = () => simulatedTime;

  try {
    const service = createNotificationService({ dedupeWindowMs: 10000 });
    let showCount = 0;
    let capturedNotification = null;

    service.setAdapter({
      show: (notif) => {
        showCount++;
        capturedNotification = notif;
        return `toast-${showCount}`;
      },
      update: () => {},
      dismiss: () => {},
      clearAll: () => {},
    });

    const id1 = service.info("Tác vụ", "Đang chạy", { key: "task-5s", duration: 5 });
    assert.equal(capturedNotification.duration, 5000, "duration: 5 should be normalized to 5000ms");
    assert.equal(showCount, 1);

    // After 200ms (> 5ms nhưng < 5000ms): Toast KHÔNG bị coi là hết hạn
    simulatedTime += 200;
    const id2 = service.info("Tác vụ", "Đang chạy", { key: "task-5s", duration: 5 });
    assert.equal(showCount, 1, "Toast must not be considered expired after 200ms");
    assert.equal(id1, id2);

    // After thêm 5001ms (> 5000ms): Toast đã hết hạn -> Tạo toast mới độc lập
    simulatedTime += 5001;
    const id3 = service.info("Tác vụ", "Chạy lại tác vụ mới", { key: "task-5s", duration: 5 });
    assert.equal(showCount, 2, "Toast must be considered expired after 5000ms and create a new toast");
    assert.notEqual(id1, id3);
  } finally {
    Date.now = originalNow;
  }
});

// Case 5: Khác key hoàn toàn -> Tạo toast mới độc lập
test("dedupe Case 5: different keys create independent toasts", () => {
  const service = createNotificationService();
  let showCount = 0;

  service.setAdapter({
    show: (notif) => {
      showCount++;
      return notif.id;
    },
    dismiss: () => {},
    clearAll: () => {},
  });

  const id1 = service.info("Đơn hàng", "Đơn #1", { key: "order-1" });
  const id2 = service.info("Đơn hàng", "Đơn #2", { key: "order-2" });

  assert.equal(showCount, 2);
  assert.notEqual(id1, id2);
});

test("service maintains notification history capped at maxHistory (NTF-014)", () => {
  const service = createNotificationService({ maxHistory: 3 });
  service.setAdapter({ show: (n) => n.id, dismiss: () => {}, clearAll: () => {} });

  service.info("1", "Message 1");
  service.info("2", "Message 2");
  service.info("3", "Message 3");
  service.info("4", "Message 4");

  const history = service.getHistory();
  assert.equal(history.length, 3);
  assert.equal(history[0].title, "4");
  assert.equal(history[1].title, "3");
  assert.equal(history[2].title, "2");
});

test("notificationAnalytics engine tracks telemetry metrics and events (NTF-012)", () => {
  resetAnalyticsMetrics();
  const service = createNotificationService();

  let adapterCallbacks = null;
  service.setAdapter({
    show: (notif, cbs) => {
      adapterCallbacks = cbs;
      return notif.id;
    },
    dismiss: () => {},
    clearAll: () => {},
  });

  service.success("Đơn hàng mới", "Nhận đơn #101");
  service.warning("Cảnh báo", "Thời gian chuẩn bị sắp trễ");

  let metrics = getNotificationAnalyticsMetrics();
  assert.equal(metrics.totalShown, 2);
  assert.equal(metrics.shownByType.success, 1);
  assert.equal(metrics.shownByType.warning, 1);

  // Trigger user action click
  adapterCallbacks.onActionClick({ label: "Xem đơn hàng" });
  metrics = getNotificationAnalyticsMetrics();
  assert.equal(metrics.actionClicks, 1);

  // Trigger dismiss
  adapterCallbacks.onClose();
  metrics = getNotificationAnalyticsMetrics();
  assert.equal(metrics.totalDismissed, 1);
  assert.equal(metrics.dismissRate, 50); // 1 / 2 = 50%
});

test("service normalizes vague titles per NTF-004", () => {
  const service = createNotificationService();
  service.setAdapter({ show: (n) => n.id, dismiss: () => {}, clearAll: () => {} });

  service.error("Error", "Chi tiết lỗi");
  const last = service.getHistory()[0];
  assert.equal(last.title, DEFAULT_TITLES.error); // "Không thể thực hiện"
  assert.notEqual(last.title, "Error");
});

test("analytics payload conforms strictly to NTF-018 schema", () => {
  // Mock window.dataLayer and window.dispatchEvent
  const dataLayerMock = [];
  const eventsDispatched = [];
  globalThis.window = {
    dataLayer: dataLayerMock,
    dispatchEvent: (evt) => eventsDispatched.push(evt),
  };

  const service = createNotificationService({ defaultAudience: "restaurant" });
  let callbacks = null;
  service.setAdapter({
    show: (notif, cbs) => {
      callbacks = cbs;
      return notif.id;
    },
    dismiss: () => {},
    clearAll: () => {},
  });

  service.info("Đơn hàng mới", "Nhận đơn món gà rán", {
    key: "new-order-1",
    priority: "high",
    actions: [{ label: "Xem chi tiết", onClick: () => {} }],
  });

  assert.equal(dataLayerMock.length, 1);
  const payload = dataLayerMock[0];
  assert.equal(payload.event, "dronefood_notification_event");
  assert.equal(payload.action, "show");
  assert.equal(payload.notificationType, "info");
  assert.equal(payload.priority, "high");
  assert.equal(payload.audience, "restaurant");
  assert.equal(payload.key, "new-order-1");
  assert.equal(payload.hasAction, true);
  assert.equal(typeof payload.timestamp, "number");

  // Trigger action click
  callbacks.onActionClick({ label: "Xem chi tiết" });
  assert.equal(dataLayerMock.length, 2);
  const actionPayload = dataLayerMock[1];
  assert.equal(actionPayload.action, "action_click");
  assert.equal(actionPayload.event, "dronefood_notification_event");

  // Trigger dismiss
  callbacks.onClose();
  assert.equal(dataLayerMock.length, 3);
  const dismissPayload = dataLayerMock[2];
  assert.equal(dismissPayload.action, "dismiss");
  assert.equal(dismissPayload.event, "dronefood_notification_event");

  delete globalThis.window;
});

const loadToastAction = async () => import("../components/toastAction.js").catch(() => ({}));

test("toast action invokes business callback and analytics callback before closing", async () => {
  const { runToastAction } = await loadToastAction();
  assert.equal(typeof runToastAction, "function");

  const action = { label: "Thử lại", onClick: () => calls.push("business") };
  const calls = [];

  runToastAction(action, (receivedAction) => {
    calls.push(receivedAction === action ? "analytics" : "wrong-action");
  }, () => calls.push("close"));

  assert.deepEqual(calls, ["business", "analytics", "close"]);
});

test("toast action reports analytics and closes even when the business callback throws", async () => {
  const { runToastAction } = await loadToastAction();
  assert.equal(typeof runToastAction, "function");

  const failure = new Error("business callback failed");
  const calls = [];
  const action = {
    label: "Thử lại",
    onClick: () => {
      calls.push("business");
      throw failure;
    },
  };

  assert.throws(
    () => runToastAction(action, () => calls.push("analytics"), () => calls.push("close")),
    failure
  );
  assert.deepEqual(calls, ["business", "analytics", "close"]);
});

test("toast action still closes when the analytics callback throws", async () => {
  const { runToastAction } = await loadToastAction();
  assert.equal(typeof runToastAction, "function");

  const failure = new Error("analytics callback failed");
  const calls = [];
  const action = { label: "Thử lại", onClick: () => calls.push("business") };

  assert.throws(
    () => runToastAction(action, () => {
      calls.push("analytics");
      throw failure;
    }, () => calls.push("close")),
    failure
  );
  assert.deepEqual(calls, ["business", "analytics", "close"]);
});

test("toast action click reaches notification analytics dataLayer event", async () => {
  const { runToastAction } = await loadToastAction();
  assert.equal(typeof runToastAction, "function");

  const previousWindow = globalThis.window;
  const dataLayer = [];
  globalThis.window = {
    dataLayer,
    dispatchEvent: () => {},
  };

  try {
    const service = createNotificationService({ defaultAudience: "user" });
    let rendered = null;
    service.setAdapter({
      show: (notification, callbacks) => {
        rendered = { notification, callbacks };
        return notification.id;
      },
      dismiss: () => {},
      clearAll: () => {},
    });

    let retried = 0;
    service.error("Không thể hủy đơn", "Thử lại sau.", {
      audience: "user",
      key: "cancel-order-1",
      actions: [{ label: "Thử lại", onClick: () => { retried += 1; } }],
    });

    runToastAction(
      rendered.notification.actions[0],
      rendered.callbacks.onActionClick,
      () => {}
    );

    assert.equal(retried, 1);
    assert.equal(dataLayer.length, 2);
    const payload = dataLayer.at(-1);
    assert.equal(payload.event, "dronefood_notification_event");
    assert.equal(payload.action, "action_click");
    assert.equal(payload.notificationType, "error");
    assert.equal(payload.audience, "user");
    assert.equal(payload.key, "cancel-order-1");
    assert.equal(payload.hasAction, true);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("multi-action: adapter forwards the actual second action to service analytics", async () => {
  const toastAdapterSource = await readFile(
    new URL("../utils/toast.jsx", import.meta.url),
    "utf8"
  );
  const onActionFactories = [
    ...toastAdapterSource.matchAll(
      /onAction:\s*\(action\)\s*=>\s*\{\s*if \(callbacks\.onActionClick\) \{\s*callbacks\.onActionClick\(\s*action \|\| notification\.actions\?\.\[0\] \|\| \{ label: notification\.actionText \}\s*\);\s*\}\s*\}/g
    ),
  ];
  assert.equal(onActionFactories.length, 2, "Both show and update paths must forward action");

  const previousWindow = globalThis.window;
  const dataLayer = [];
  globalThis.window = { dataLayer, dispatchEvent: () => {} };

  try {
    const service = createNotificationService({ defaultAudience: "user" });
    let rendered = null;
    const analyticsEvents = [];
    service.onAnalyticsEvent((event) => analyticsEvents.push(event));
    service.setAdapter({
      show: (notification, callbacks) => {
        rendered = { notification, callbacks };
        return notification.id;
      },
      dismiss: () => {},
      clearAll: () => {},
    });

    let retryCount = 0;
    let cancelCount = 0;
    service.error("Không thể hủy đơn", "Chọn một thao tác.", {
      actions: [
        { label: "Thử lại", onClick: () => { retryCount += 1; } },
        { label: "Hủy đơn", onClick: () => { cancelCount += 1; } },
      ],
    });
    const { runToastAction } = await loadToastAction();

    runToastAction(
      rendered.notification.actions[1],
      rendered.callbacks.onActionClick,
      () => {}
    );

    const actionClick = analyticsEvents.find((event) => event.type === "action_click");
    assert.equal(retryCount, 0);
    assert.equal(cancelCount, 1);
    assert.equal(actionClick.action, rendered.notification.actions[1]);
    assert.equal(actionClick.action.label, "Hủy đơn");
    assert.equal(dataLayer.at(-1).action, "action_click");
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("toast component uses accent-border layout without a status icon", async () => {
  const toastComponentSource = await readFile(
    new URL("../components/ToastNotification.jsx", import.meta.url),
    "utf8"
  );

  assert.match(toastComponentSource, /className=\{`df-toast df-toast--\$\{type\}`\}/);
  assert.doesNotMatch(toastComponentSource, /df-toast-badge/);
  assert.doesNotMatch(toastComponentSource, /ToastIcons/);
});

test("React-Toastify adapter preserves single-action analytics forwarding", async () => {
  const toastAdapterSource = await readFile(
    new URL("../utils/toast.jsx", import.meta.url),
    "utf8"
  );
  const onActionFactories = [
    ...toastAdapterSource.matchAll(
      /onAction:\s*\(action\)\s*=>\s*\{\s*if \(callbacks\.onActionClick\) \{\s*callbacks\.onActionClick\(\s*action \|\| notification\.actions\?\.\[0\] \|\| \{ label: notification\.actionText \}\s*\);\s*\}\s*\}/g
    ),
  ];

  assert.equal(onActionFactories.length, 2);

  const action = { label: "Thử lại", onClick: () => {} };
  let analyticsAction = null;
  const adapterOnAction = (receivedAction) => {
    analyticsAction = receivedAction || action || { label: undefined };
  };
  const { runToastAction } = await loadToastAction();

  runToastAction(action, adapterOnAction, () => {});

  assert.equal(analyticsAction, action);
  assert.equal(analyticsAction.label, "Thử lại");
});

test("React-Toastify adapter retains legacy action fallback", async () => {
  const toastAdapterSource = await readFile(
    new URL("../utils/toast.jsx", import.meta.url),
    "utf8"
  );
  const fallbackExpressions = [
    ...toastAdapterSource.matchAll(
      /action \|\| notification\.actions\?\.\[0\] \|\| \{ label: notification\.actionText \}/g
    ),
  ];

  assert.equal(fallbackExpressions.length, 2);

  const legacyAction = { label: "Thử lại" };
  const adapterOnAction = (action) => action || undefined || legacyAction;

  assert.equal(adapterOnAction(undefined), legacyAction);
  assert.equal(adapterOnAction(undefined).label, "Thử lại");
});

test("migration pattern: customer cancel-order error produces correct service state", () => {
  const service = createNotificationService({ defaultAudience: "admin" });
  let showCount = 0;
  let adapterNotification = null;
  service.setAdapter({
    show: (notification) => {
      showCount += 1;
      adapterNotification = notification;
      return notification.id;
    },
    dismiss: () => {},
    clearAll: () => {},
  });

  const options = {
    audience: "user",
    priority: "high",
    persistent: true,
    duration: 0,
    key: "cancel-order-abc123",
    actions: [{ label: "Thử lại", onClick: () => {} }],
  };

  const firstId = service.error(
    "Hủy đơn không thành công",
    "Không thể hủy đơn vào lúc này.",
    options
  );
  const repeatedId = service.error(
    "Hủy đơn không thành công",
    "Không thể hủy đơn vào lúc này.",
    options
  );
  const notification = service.getHistory()[0];

  assert.equal(notification.audience, "user");
  assert.equal(notification.key, "cancel-order-abc123");
  assert.equal(notification.persistent, true);
  assert.equal(notification.duration, false);
  assert.equal(notification.position, "bottom-right");
  assert.equal(notification.actions.length, 1);
  assert.equal(notification.actions[0].label, "Thử lại");
  assert.equal(adapterNotification.duration, false);
  assert.equal(adapterNotification.actions, notification.actions);
  assert.equal(showCount, 1, "Repeated pilot key must be deduplicated");
  assert.equal(repeatedId, firstId);
  assert.equal(resolvePosition("user"), "bottom-right");
});

test("migration pattern: admin preflight error produces correct service state", () => {
  const service = createNotificationService({ defaultAudience: "user" });
  let showCount = 0;
  let adapterNotification = null;
  service.setAdapter({
    show: (notification) => {
      showCount += 1;
      adapterNotification = notification;
      return notification.id;
    },
    dismiss: () => {},
    clearAll: () => {},
  });

  const options = {
    audience: "admin",
    priority: "critical",
    persistent: true,
    duration: 0,
    key: "preflight-xyz",
    actions: [{ label: "Kiểm tra lại", onClick: () => {} }],
  };

  const firstId = service.error(
    "Kiểm tra tiền bay không đạt",
    "Drone không đủ điều kiện an toàn để cất cánh.",
    options
  );
  const repeatedId = service.error(
    "Kiểm tra tiền bay không đạt",
    "Drone không đủ điều kiện an toàn để cất cánh.",
    options
  );
  const notification = service.getHistory()[0];

  assert.equal(notification.audience, "admin");
  assert.equal(notification.key, "preflight-xyz");
  assert.equal(notification.priority, "critical");
  assert.equal(notification.persistent, true);
  assert.equal(notification.duration, false);
  assert.equal(notification.position, "top-right");
  assert.equal(notification.actions.length, 1);
  assert.equal(notification.actions[0].label, "Kiểm tra lại");
  assert.equal(adapterNotification.duration, false);
  assert.equal(adapterNotification.actions, notification.actions);
  assert.equal(showCount, 1, "Repeated pilot key must be deduplicated");
  assert.equal(repeatedId, firstId);
  assert.equal(resolvePosition("admin"), "top-right");
});

test("analytics payload includes actionLabel and actionIndex for action clicks", async () => {
  const previousWindow = globalThis.window;
  const dataLayer = [];
  globalThis.window = { dataLayer, dispatchEvent: () => {} };

  try {
    const service = createNotificationService({ defaultAudience: "user" });
    let adapterCallbacks = null;
    let adapterNotification = null;

    service.setAdapter({
      show: (notification, callbacks) => {
        adapterNotification = notification;
        adapterCallbacks = callbacks;
        return notification.id;
      },
      dismiss: () => {},
      clearAll: () => {},
    });

    service.error("Lỗi thao tác", "Vui lòng chọn xử lý.", {
      key: "test-action-labels-1",
      actions: [
        { label: "Thử lại", onClick: () => {} },
        { label: "Hủy bỏ", onClick: () => {} },
      ],
    });

    assert.equal(dataLayer.length, 1);
    assert.equal(dataLayer[0].action, "show");
    assert.equal(dataLayer[0].actionLabel, null);
    assert.equal(dataLayer[0].actionIndex, null);

    const { runToastAction } = await loadToastAction();

    // Click action thứ hai: "Hủy bỏ"
    runToastAction(
      adapterNotification.actions[1],
      adapterCallbacks.onActionClick,
      () => {}
    );

    assert.equal(dataLayer.length, 2);
    const clickPayload = dataLayer[1];
    assert.equal(clickPayload.action, "action_click");
    assert.equal(clickPayload.actionLabel, "Hủy bỏ");
    assert.equal(clickPayload.actionIndex, 1);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("pilot P0: customer cancel-order error renders action and triggers analytics", async () => {
  const previousWindow = globalThis.window;
  const dataLayer = [];
  globalThis.window = { dataLayer, dispatchEvent: () => {} };

  try {
    const service = createNotificationService({ defaultAudience: "user" });
    let retryCount = 0;
    let adapterNotification = null;
    let adapterCallbacks = null;

    service.setAdapter({
      show: (notification, callbacks) => {
        adapterNotification = notification;
        adapterCallbacks = callbacks;
        return notification.id;
      },
      dismiss: () => {},
      clearAll: () => {},
    });

    service.error(
      "Hủy đơn không thành công",
      "Không thể hủy đơn vào lúc này.",
      {
        audience: "user",
        priority: "high",
        persistent: true,
        duration: 0,
        key: "cancel-order-abc123",
        actions: [{ label: "Thử lại", onClick: () => { retryCount += 1; } }],
      }
    );

    // Verify notification state
    const notif = service.getHistory().at(0);
    assert.equal(notif.audience, "user");
    assert.equal(notif.priority, "high");
    assert.equal(notif.persistent, true);
    assert.equal(notif.duration, false);
    assert.equal(notif.actions.length, 1);
    assert.equal(notif.actions[0].label, "Thử lại");

    const { runToastAction } = await loadToastAction();

    // Simulate action click
    runToastAction(
      adapterNotification.actions[0],
      adapterCallbacks.onActionClick,
      () => {}
    );

    // Verify business callback chạy
    assert.equal(retryCount, 1, "Business retry callback must run");

    // Verify analytics push với actionLabel
    const actionClickEvent = dataLayer.find((e) => e.action === "action_click");
    assert.ok(actionClickEvent, "action_click event must be pushed");
    assert.equal(actionClickEvent.actionLabel, "Thử lại");
    assert.equal(actionClickEvent.actionIndex, 0);
    assert.equal(actionClickEvent.audience, "user");
    assert.equal(actionClickEvent.key, "cancel-order-abc123");
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("pilot P0: admin preflight error renders action and triggers analytics", async () => {
  const previousWindow = globalThis.window;
  const dataLayer = [];
  globalThis.window = { dataLayer, dispatchEvent: () => {} };

  try {
    const service = createNotificationService({ defaultAudience: "admin" });
    let recheckCount = 0;
    let adapterNotification = null;
    let adapterCallbacks = null;

    service.setAdapter({
      show: (notification, callbacks) => {
        adapterNotification = notification;
        adapterCallbacks = callbacks;
        return notification.id;
      },
      dismiss: () => {},
      clearAll: () => {},
    });

    service.error(
      "Kiểm tra tiền bay không đạt",
      "Drone không đủ điều kiện an toàn để cất cánh. Vui lòng kiểm tra lại thiết bị.",
      {
        audience: "admin",
        priority: "critical",
        persistent: true,
        duration: 0,
        key: "preflight-xyz",
        actions: [{ label: "Kiểm tra lại", onClick: () => { recheckCount += 1; } }],
      }
    );

    // Verify notification state
    const notif = service.getHistory().at(0);
    assert.equal(notif.audience, "admin");
    assert.equal(notif.priority, "critical");
    assert.equal(notif.persistent, true);
    assert.equal(notif.duration, false);
    assert.equal(notif.actions.length, 1);
    assert.equal(notif.actions[0].label, "Kiểm tra lại");

    const { runToastAction } = await loadToastAction();

    // Simulate action click
    runToastAction(
      adapterNotification.actions[0],
      adapterCallbacks.onActionClick,
      () => {}
    );

    // Verify business callback chạy
    assert.equal(recheckCount, 1, "Business recheck callback must run");

    // Verify analytics push với actionLabel
    const actionClickEvent = dataLayer.find((e) => e.action === "action_click");
    assert.ok(actionClickEvent, "action_click event must be pushed");
    assert.equal(actionClickEvent.actionLabel, "Kiểm tra lại");
    assert.equal(actionClickEvent.actionIndex, 0);
    assert.equal(actionClickEvent.audience, "admin");
    assert.equal(actionClickEvent.key, "preflight-xyz");
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
