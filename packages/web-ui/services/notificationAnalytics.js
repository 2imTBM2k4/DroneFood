/**
 * NTF-STD-001 Notification Analytics & Telemetry Engine
 * Tracks:
 * - Notification show count by type (success, info, warning, error)
 * - User action clicks
 * - Dismissal counts and dismiss rate
 * - Integration with window.dataLayer (Google Tag Manager / GA4)
 * - Custom DOM event dispatching for app-wide event bus
 */

const metrics = {
  totalShown: 0,
  shownByType: {
    success: 0,
    info: 0,
    warning: 0,
    error: 0,
  },
  actionClicks: 0,
  actionClicksByType: {
    success: 0,
    info: 0,
    warning: 0,
    error: 0,
  },
  totalDismissed: 0,
  dismissRate: 0, // percentage 0 - 100%
  recentEvents: [],
};

const MAX_RECENT_EVENTS = 50;

/**
 * Reset metrics (useful for testing)
 */
export function resetAnalyticsMetrics() {
  metrics.totalShown = 0;
  metrics.shownByType = { success: 0, info: 0, warning: 0, error: 0 };
  metrics.actionClicks = 0;
  metrics.actionClicksByType = { success: 0, info: 0, warning: 0, error: 0 };
  metrics.totalDismissed = 0;
  metrics.dismissRate = 0;
  metrics.recentEvents = [];
}

/**
 * Returns read-only snapshot of current notification telemetry
 */
export function getNotificationAnalyticsMetrics() {
  return {
    ...metrics,
    shownByType: { ...metrics.shownByType },
    actionClicksByType: { ...metrics.actionClicksByType },
    recentEvents: [...metrics.recentEvents],
  };
}

/**
 * Record an event into the analytics pipeline
 * @param {Object} event
 * @param {'show' | 'action_click' | 'dismiss' | 'clear_all'} event.type
 * @param {Object} [event.notification]
 * @param {Object} [event.action]
 */
export function trackNotificationEvent(event) {
  const timestamp = Date.now();
  const entry = { ...event, timestamp };

  // Update in-memory telemetry
  if (event.type === "show" && event.notification) {
    metrics.totalShown += 1;
    const notifType = event.notification.type || "info";
    if (metrics.shownByType[notifType] !== undefined) {
      metrics.shownByType[notifType] += 1;
    }
  } else if (event.type === "action_click") {
    metrics.actionClicks += 1;
    const notifType = event.notification?.type || "info";
    if (metrics.actionClicksByType[notifType] !== undefined) {
      metrics.actionClicksByType[notifType] += 1;
    }
  } else if (event.type === "dismiss") {
    metrics.totalDismissed += 1;
  }

  // Calculate live dismiss rate
  if (metrics.totalShown > 0) {
    metrics.dismissRate = Number(((metrics.totalDismissed / metrics.totalShown) * 100).toFixed(1));
  }

  metrics.recentEvents.unshift(entry);
  if (metrics.recentEvents.length > MAX_RECENT_EVENTS) {
    metrics.recentEvents.pop();
  }

  // Map action according to NTF-018: 'show' | 'action_click' | 'dismiss'
  let action = "show";
  if (event.type === "action_click") {
    action = "action_click";
  } else if (event.type === "dismiss") {
    action = "dismiss";
  }

  // NTF-018 strict schema payload
  const notif = event.notification || {};
  const clickedAction = event.action || null;
  let actionIndex = typeof event.actionIndex === "number" ? event.actionIndex : null;
  if (actionIndex === null && Array.isArray(notif.actions) && clickedAction) {
    const idx = notif.actions.findIndex(
      (a) => a === clickedAction || (a && clickedAction && a.label === clickedAction.label)
    );
    if (idx !== -1) {
      actionIndex = idx;
    }
  }

  const analyticsPayload = {
    event: "dronefood_notification_event",
    action,
    notificationType: notif.type || "info",
    priority: notif.priority || "medium",
    audience: notif.audience,
    key: notif.key,
    hasAction: Boolean(notif.actions?.length || notif.actionText),
    actionLabel: clickedAction?.label || null,
    actionIndex: typeof actionIndex === "number" ? actionIndex : null,
    timestamp,
  };

  // Push to window.dataLayer if present (standard Google Analytics / GTM)
  if (typeof window !== "undefined") {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(analyticsPayload);
    }

    // Dispatch DOM CustomEvent for browser telemetry listeners
    try {
      window.dispatchEvent(
        new CustomEvent("dronefood:notification_analytics", {
          detail: analyticsPayload,
        })
      );
    } catch {
      // Ignore if event dispatch fails in restricted environments
    }
  }
}

/**
 * Initializes analytics subscription on a NotificationService instance
 */
export function initNotificationAnalytics(service) {
  if (!service || typeof service.onAnalyticsEvent !== "function") return () => {};
  return service.onAnalyticsEvent(trackNotificationEvent);
}

export default {
  trackNotificationEvent,
  getNotificationAnalyticsMetrics,
  resetAnalyticsMetrics,
  initNotificationAnalytics,
};
