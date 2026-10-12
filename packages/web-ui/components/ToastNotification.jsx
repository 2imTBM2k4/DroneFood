import React, { useEffect, useRef } from "react";

const DEFAULT_TITLES = {
  info: "Thông báo",
  success: "Thành công",
  warning: "Chú ý",
  error: "Không thể hoàn thành",
};

export const ToastNotification = ({
  type = "info",
  title,
  message,
  closeToast,
}) => {
  const containerRef = useRef(null);
  const resolvedTitle = title ?? DEFAULT_TITLES[type] ?? "Thông báo";

  // NTF-008: Esc key dismisses toast
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && closeToast) {
        closeToast();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeToast]);

  // NTF-008: ARIA live roles based on urgency
  const isUrgent = type === "error" || type === "warning";
  const role = isUrgent ? "alert" : "status";
  const ariaLive = isUrgent ? "assertive" : "polite";

  return (
    <div
      ref={containerRef}
      className={`df-toast df-toast--${type}`}
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <div className="df-toast-header">
        <h4 className="df-toast-title">{resolvedTitle}</h4>
      </div>

      {message && <p className="df-toast-message">{message}</p>}
    </div>
  );
};

export default ToastNotification;
