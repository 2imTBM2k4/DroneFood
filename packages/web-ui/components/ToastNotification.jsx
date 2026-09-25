import React from "react";

const ToastIcons = {
  info: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="7" r="2" />
      <rect x="10.25" y="10.5" width="3.5" height="8" rx="1.75" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="10.25" y="5.5" width="3.5" height="9" rx="1.75" />
      <circle cx="12" cy="17.5" r="2" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

const DEFAULT_TITLES = {
  info: "Thông báo",
  success: "Thành công!",
  warning: "Chú ý!",
  error: "Đã xảy ra lỗi!",
};

export const ToastNotification = ({
  type = "info",
  title,
  message,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  closeToast,
}) => {
  const resolvedTitle = title ?? DEFAULT_TITLES[type] ?? "Thông báo";

  const handleAction = (e) => {
    e.stopPropagation();
    if (onAction) {
      onAction();
    }
    if (closeToast) {
      closeToast();
    }
  };

  const handleSecondary = (e) => {
    e.stopPropagation();
    if (onSecondaryAction) {
      onSecondaryAction();
    }
    if (closeToast) {
      closeToast();
    }
  };

  return (
    <div className={`df-toast df-toast--${type}`}>
      <div className="df-toast-header">
        <div className="df-toast-badge" aria-hidden="true">
          {ToastIcons[type] || ToastIcons.info}
        </div>
        <h4 className="df-toast-title">{resolvedTitle}</h4>
      </div>

      {message && <p className="df-toast-message">{message}</p>}

      {(actionText || secondaryActionText) && (
        <div className="df-toast-actions">
          {actionText && (
            <button
              type="button"
              className="df-toast-btn-action"
              onClick={handleAction}
            >
              {actionText}
            </button>
          )}
          {secondaryActionText && (
            <button
              type="button"
              className="df-toast-btn-secondary"
              onClick={handleSecondary}
            >
              {secondaryActionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ToastNotification;
