/**
 * NTF-STD-001 Compliant Notification Service
 * Single source of truth for web application notifications across DroneFood.
 */
import { initNotificationAnalytics } from "./notificationAnalytics.js";

/**
 * @typedef {Object} AppNotification
 * @property {string} id
 * @property {string} [key] - Dùng để dedupe
 * @property {'success'|'info'|'warning'|'error'} type
 * @property {string} title
 * @property {string} [message]
 * @property {number|boolean} [duration] - Thời lượng auto-dismiss, đơn vị milliseconds. 0 = persistent.
 * @property {boolean} [persistent]
 * @property {'low'|'medium'|'high'|'critical'} [priority]
 * @property {'user'|'restaurant'|'admin'} [audience]
 * @property {string} [position]
 * @property {Array<{label: string, onClick: Function, style?: string}>} [actions]
 * @property {number} createdAt
 * @property {boolean} [read]
 */

/**
 * Resolves toast position based on role / audience:
 * - user: bottom-right (desktop)
 * - restaurant: top-right (desktop)
 * - admin: top-right (desktop)
 * - fallback: top-right
 * @param {'user' | 'restaurant' | 'admin'} [audience]
 * @returns {'bottom-right' | 'top-right'}
 */
export function resolvePosition(audience) {
  switch (audience) {
    case "user":
      return "bottom-right";
    case "restaurant":
    case "admin":
      return "top-right";
    default:
      return "top-right";
  }
}

/**
 * Default durations based on NTF-005:
 * - success / info: 3-5s (4000ms)
 * - warning: 6-8s (6500ms)
 * - error: 8000ms (or false / persistent if requiring manual action)
 */
export const DEFAULT_DURATIONS = {
  success: 4000,
  info: 4000,
  warning: 6500,
  error: 8000,
};

export const DEFAULT_TITLES = {
  success: "Thành công",
  info: "Thông báo",
  warning: "Chú ý",
  error: "Không thể thực hiện",
};

/**
 * Creates an instance of NotificationService
 * @param {Object} [config]
 * @param {'user' | 'restaurant' | 'admin'} [config.defaultAudience='admin']
 * @param {number} [config.maxHistory=50]
 * @param {number} [config.dedupeWindowMs=2000]
 * @param {Function} [config.toastRenderer] - Pluggable toast function (defaults to react-toastify or custom adapter)
 */
export function createNotificationService(config = {}) {
  const defaultAudience = config.defaultAudience || "admin";
  const maxHistory = config.maxHistory || 50;
  const dedupeWindowMs = config.dedupeWindowMs || 2000;

  const history = [];
  const activeKeys = new Map(); // key -> { id, timestamp, type, title, message }
  const listeners = new Set();
  let toastAdapter = config.toastRenderer || null;

  const emitEvent = (event) => {
    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("[NotificationService] Listener error:", err);
      }
    });
  };

  /**
   * Set or override the underlying toast display adapter (e.g., react-toastify)
   */
  const setAdapter = (adapter) => {
    toastAdapter = adapter;
  };

  /**
   * Normalize input into structured AppNotification object
   */
  const normalizeInput = (type, titleOrInput, messageOrOptions, options = {}) => {
    let title = "";
    let message = "";
    let opts = {};

    if (titleOrInput && typeof titleOrInput === "object") {
      opts = { ...titleOrInput };
      title = opts.title || DEFAULT_TITLES[type] || "Thông báo";
      message = opts.message || opts.text || "";
    } else if (typeof titleOrInput === "string") {
      title = titleOrInput;
      if (typeof messageOrOptions === "string") {
        message = messageOrOptions;
        opts = { ...options };
      } else if (messageOrOptions && typeof messageOrOptions === "object") {
        opts = { ...messageOrOptions };
        message = opts.message || "";
      } else {
        opts = { ...options };
      }
    }

    // NTF-004: Avoid vague titles/messages
    if (!title || title.trim() === "Error" || title.trim() === "Có lỗi xảy ra" || title.trim() === "Oops!") {
      title = DEFAULT_TITLES[type] || "Thông báo";
    }

    const audience = opts.audience || defaultAudience;
    const position = opts.position || resolvePosition(audience);

    // NTF-005: Duration rules
    let duration = opts.duration;
    let persistent = opts.persistent ?? false;

    // Heuristic: duration trong [1,99] được coi là giây, tự động nhân 1000 về milliseconds
    if (typeof duration === "number" && duration > 0 && duration < 100) {
      duration = duration * 1000;
    }

    // Critical or explicit persistent or duration=0/false
    if (opts.priority === "critical" || opts.persistent === true || opts.duration === 0 || opts.duration === false) {
      persistent = true;
      duration = false;
    } else if (duration === undefined) {
      if (type === "error" && (opts.actions?.length || opts.requireAction)) {
        duration = false;
        persistent = true;
      } else {
        duration = DEFAULT_DURATIONS[type] || 4000;
      }
    }

    const key = opts.key || `${type}:${title}:${message}`;
    const actions = opts.actions || (opts.actionText ? [{ label: opts.actionText, onClick: opts.onAction }] : undefined);
    const dedupeWindow = opts.dedupeWindow ?? dedupeWindowMs;

    return {
      ...opts,
      type,
      title,
      message,
      duration,
      persistent,
      priority: opts.priority || "medium",
      audience,
      position,
      key,
      actions,
      dedupeWindow,
    };
  };

  /**
   * Show a notification
   */
  const show = (input) => {
    const type = input.type || "info";
    const notificationData = normalizeInput(type, input);
    const now = Date.now();
    const dedupeWindow = notificationData.dedupeWindow ?? dedupeWindowMs;

    // NTF-006 & Section 6: Dedupe logic (5 edge cases)
    if (notificationData.key) {
      const existing = activeKeys.get(notificationData.key);
      if (existing) {
        const timeSinceLastShow = now - existing.timestamp;
        const timeSinceCreated = now - existing.createdAt;
        const isDurationExpired = !existing.persistent && existing.duration && timeSinceCreated >= existing.duration;
        const isWindowExpired = timeSinceLastShow >= dedupeWindow;

        // Case 4: Old toast has auto-dismissed or expired -> Create new toast (do not update dead toast)
        if (existing.isDismissed || isDurationExpired || isWindowExpired) {
          activeKeys.delete(notificationData.key);
        } else {
          const isIdentical =
            existing.type === notificationData.type &&
            existing.title === notificationData.title &&
            existing.message === notificationData.message;

          // Case 1: Same key, same message, same type, within window -> Suppress
          if (isIdentical) {
            // Case 3: Window counts from most recent show
            existing.timestamp = now;
            return existing.id;
          }

          // Case 2 & Case 3: Same key, different message or type -> update in-place, reset timer
          const updatedNotification = {
            ...notificationData,
            id: existing.id,
            createdAt: now,
            read: false,
          };

          activeKeys.set(notificationData.key, {
            id: existing.id,
            timestamp: now,
            createdAt: now,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            duration: notificationData.duration,
            persistent: notificationData.persistent,
            isDismissed: false,
          });

          history.unshift(updatedNotification);
          if (history.length > maxHistory) history.pop();

          emitEvent({
            type: "update",
            notification: updatedNotification,
            previousId: existing.id,
          });

          if (toastAdapter && typeof toastAdapter.update === "function") {
            toastAdapter.update(existing.id, updatedNotification, {
              onClose: () => {
                const current = activeKeys.get(notificationData.key);
                if (current && current.id === existing.id) {
                  current.isDismissed = true;
                  activeKeys.delete(notificationData.key);
                }
                emitEvent({ type: "dismiss", id: existing.id, notification: updatedNotification });
              },
              onActionClick: (action) => {
                emitEvent({ type: "action_click", id: existing.id, notification: updatedNotification, action });
              },
            });
          } else if (toastAdapter && typeof toastAdapter.show === "function") {
            if (typeof toastAdapter.dismiss === "function") {
              toastAdapter.dismiss(existing.id);
            }
            toastAdapter.show(updatedNotification, {
              onClose: () => {
                const current = activeKeys.get(notificationData.key);
                if (current && current.id === existing.id) {
                  current.isDismissed = true;
                  activeKeys.delete(notificationData.key);
                }
                emitEvent({ type: "dismiss", id: existing.id, notification: updatedNotification });
              },
              onActionClick: (action) => {
                emitEvent({ type: "action_click", id: existing.id, notification: updatedNotification, action });
              },
            });
          }

          return existing.id;
        }
      }
    }

    // Case 5 & New Toast Creation:
    const id = notificationData.id || `notif_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const notification = {
      ...notificationData,
      id,
      createdAt: now,
      read: false,
    };

    activeKeys.set(notification.key, {
      id,
      timestamp: now,
      createdAt: now,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      duration: notification.duration,
      persistent: notification.persistent,
      isDismissed: false,
    });

    // Store in history (NTF-014)
    history.unshift(notification);
    if (history.length > maxHistory) {
      history.pop();
    }

    // NTF-012: Analytics logging
    emitEvent({
      type: "show",
      notification,
    });

    // Delegate to toast adapter if available
    if (toastAdapter && typeof toastAdapter.show === "function") {
      toastAdapter.show(notification, {
        onClose: () => {
          const current = activeKeys.get(notification.key);
          if (current && current.id === id) {
            current.isDismissed = true;
            activeKeys.delete(notification.key);
          }
          emitEvent({ type: "dismiss", id, notification });
        },
        onActionClick: (action) => {
          emitEvent({ type: "action_click", id, notification, action });
        },
      });
    }

    return id;
  };

  const success = (title, message, options) => {
    const input = normalizeInput("success", title, message, options);
    return show(input);
  };

  const info = (title, message, options) => {
    const input = normalizeInput("info", title, message, options);
    return show(input);
  };

  const warning = (title, message, options) => {
    const input = normalizeInput("warning", title, message, options);
    return show(input);
  };

  const error = (title, message, options) => {
    const input = normalizeInput("error", title, message, options);
    return show(input);
  };

  const dismiss = (id) => {
    if (toastAdapter && typeof toastAdapter.dismiss === "function") {
      toastAdapter.dismiss(id);
    }
    for (const [k, v] of activeKeys.entries()) {
      if (v.id === id) {
        v.isDismissed = true;
        activeKeys.delete(k);
      }
    }
    emitEvent({ type: "dismiss", id });
  };

  const clearAll = () => {
    if (toastAdapter && typeof toastAdapter.clearAll === "function") {
      toastAdapter.clearAll();
    }
    activeKeys.clear();
    emitEvent({ type: "clear_all" });
  };

  const getHistory = () => [...history];

  const onAnalyticsEvent = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const service = {
    show,
    success,
    info,
    warning,
    warn: warning,
    error,
    dismiss,
    clearAll,
    getHistory,
    setAdapter,
    onAnalyticsEvent,
    resolvePosition,
    defaultAudience,
  };

  // Wire analytics tracker automatically
  initNotificationAnalytics(service);

  return service;
}

// Global default service
export const notificationService = createNotificationService({ defaultAudience: "admin" });
export default notificationService;
