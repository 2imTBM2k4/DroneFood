import "react-toastify/dist/ReactToastify.css";
import React from "react";
import { toast as reactToastifyToast } from "react-toastify";
import ToastNotification from "../components/ToastNotification";
import {
  createNotificationService,
  notificationService,
  resolvePosition,
  DEFAULT_DURATIONS,
  DEFAULT_TITLES,
} from "../services/notificationService";

/**
 * Normalizes input arguments for toast rendering
 */
const renderToastContent = (notification, options = {}) => {
  return ({ closeToast }) => (
    <ToastNotification
      type={notification.type}
      title={notification.title}
      message={notification.message}
      actions={notification.actions}
      actionText={notification.actionText || options.actionText}
      onAction={notification.actions?.length ? options.onAction : notification.onAction || options.onAction}
      secondaryActionText={notification.secondaryActionText || options.secondaryActionText}
      onSecondaryAction={notification.onSecondaryAction || options.onSecondaryAction}
      closeToast={closeToast}
    />
  );
};

// Wire up the default toast adapter to react-toastify
const createReactToastifyAdapter = () => {
  return {
    show: (notification, callbacks = {}) => {
      const position = notification.position || resolvePosition(notification.audience);
      const isPersistent = notification.persistent || notification.duration === false;
      const autoClose = isPersistent ? false : (notification.duration ?? DEFAULT_DURATIONS[notification.type] ?? 4000);

      const toastId = reactToastifyToast(
        renderToastContent(notification, {
          onAction: (action) => {
            if (callbacks.onActionClick) {
              callbacks.onActionClick(
                action || notification.actions?.[0] || { label: notification.actionText }
              );
            }
          },
        }),
        {
          toastId: notification.key || notification.id,
          type: notification.type,
          position,
          icon: false,
          closeButton: false,
          autoClose,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          onClose: () => {
            if (callbacks.onClose) callbacks.onClose();
          },
          role: notification.type === "error" || notification.type === "warning" ? "alert" : "status",
        }
      );

      return toastId;
    },
    update: (id, notification, callbacks = {}) => {
      const isPersistent = notification.persistent || notification.duration === false || notification.duration === 0;
      const autoClose = isPersistent ? false : (notification.duration ?? DEFAULT_DURATIONS[notification.type] ?? 4000);
      const content = renderToastContent(notification, {
        onAction: (action) => {
          if (callbacks.onActionClick) {
            callbacks.onActionClick(
              action || notification.actions?.[0] || { label: notification.actionText }
            );
          }
        },
      });

      if (typeof reactToastifyToast.update === "function" && reactToastifyToast.isActive?.(id)) {
        reactToastifyToast.update(id, {
          render: content,
          type: notification.type,
          closeButton: false,
          autoClose,
          closeOnClick: true,
        });
      } else {
        reactToastifyToast.dismiss(id);
        reactToastifyToast(content, {
          toastId: notification.key || notification.id,
          type: notification.type,
          position: notification.position || resolvePosition(notification.audience),
          icon: false,
          closeButton: false,
          autoClose,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          onClose: () => {
            if (callbacks.onClose) callbacks.onClose();
          },
          role: notification.type === "error" || notification.type === "warning" ? "alert" : "status",
        });
      }
    },
    dismiss: (id) => reactToastifyToast.dismiss(id),
    clearAll: () => reactToastifyToast.dismiss(),
  };
};

const defaultAdapter = createReactToastifyAdapter();
notificationService.setAdapter(defaultAdapter);

/**
 * Unified notification helper that conforms to NTF-STD-001
 */
export const notify = (content, options = {}) => {
  if (typeof content === "object" && !React.isValidElement(content)) {
    return notificationService.show({ ...content, ...options });
  }
  const type = options.type || "info";
  return notificationService.show({ type, title: options.title, message: content, ...options });
};

notify.info = (titleOrMsg, msgOrOpts, opts) => notificationService.info(titleOrMsg, msgOrOpts, opts);
notify.success = (titleOrMsg, msgOrOpts, opts) => notificationService.success(titleOrMsg, msgOrOpts, opts);
notify.warning = (titleOrMsg, msgOrOpts, opts) => notificationService.warning(titleOrMsg, msgOrOpts, opts);
notify.warn = (titleOrMsg, msgOrOpts, opts) => notificationService.warning(titleOrMsg, msgOrOpts, opts);
notify.error = (titleOrMsg, msgOrOpts, opts) => notificationService.error(titleOrMsg, msgOrOpts, opts);
notify.dismiss = (id) => notificationService.dismiss(id);
notify.clearAll = () => notificationService.clearAll();

/**
 * Backward compatibility wrapper for callers importing `{ toast }` from web-ui
 */
export const toast = {
  ...reactToastifyToast,
  success: (titleOrMsg, msgOrOpts, opts) => notificationService.success(titleOrMsg, msgOrOpts, opts),
  info: (titleOrMsg, msgOrOpts, opts) => notificationService.info(titleOrMsg, msgOrOpts, opts),
  warning: (titleOrMsg, msgOrOpts, opts) => notificationService.warning(titleOrMsg, msgOrOpts, opts),
  warn: (titleOrMsg, msgOrOpts, opts) => notificationService.warning(titleOrMsg, msgOrOpts, opts),
  error: (titleOrMsg, msgOrOpts, opts) => notificationService.error(titleOrMsg, msgOrOpts, opts),
  dismiss: (id) => notificationService.dismiss(id),
  clearWaitingQueue: () => reactToastifyToast.clearWaitingQueue(),
  isActive: (id) => reactToastifyToast.isActive(id),
};

export {
  notificationService,
  createNotificationService,
  resolvePosition,
  DEFAULT_DURATIONS,
  DEFAULT_TITLES,
};

/**
 * Re-exported host component so web apps do not import react-toastify directly.
 */
export { ToastContainer } from "react-toastify";

export default notify;
