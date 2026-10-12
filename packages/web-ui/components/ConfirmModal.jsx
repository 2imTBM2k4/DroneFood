import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

export const ConfirmModal = ({
  open = false,
  title = "Xác nhận",
  message = "Bạn có chắc chắn muốn thực hiện hành động này?",
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  danger = false,
  isPrompt = false,
  promptLabel = "",
  promptPlaceholder = "",
  defaultValue = "",
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const inputRef = useRef(null);
  const confirmBtnRef = useRef(null);

  // Sync default value when opening
  useEffect(() => {
    if (open) {
      setInputValue(defaultValue);
      previousActiveElementRef.current = document.activeElement;
    }
  }, [open, defaultValue]);

  // Focus management and trap (NTF-008, NTF-009)
  useEffect(() => {
    if (!open) {
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === "function") {
        previousActiveElementRef.current.focus();
      }
      return;
    }

    const timer = setTimeout(() => {
      if (isPrompt && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select?.();
      } else if (confirmBtnRef.current) {
        confirmBtnRef.current.focus();
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isPrompt, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    if (isPrompt) {
      onConfirm?.(inputValue);
    } else {
      onConfirm?.();
    }
  };

  const content = (
    <div
      className="df-confirm-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose?.();
        }
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`df-confirm-modal ${danger ? "is-danger" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="df-confirm-modal-title"
        aria-describedby="df-confirm-modal-desc"
      >
        <div className="df-confirm-modal-header">
          <h3 id="df-confirm-modal-title" className="df-confirm-modal-title">
            {title}
          </h3>
          <button
            type="button"
            className="df-confirm-modal-close"
            onClick={onClose}
            aria-label="Đóng"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <div id="df-confirm-modal-desc" className="df-confirm-modal-body">
          {message && <p className="df-confirm-modal-message">{message}</p>}

          {isPrompt && (
            <div className="df-confirm-modal-prompt-group">
              {promptLabel && (
                <label htmlFor="df-prompt-input" className="df-prompt-label">
                  {promptLabel}
                </label>
              )}
              <input
                id="df-prompt-input"
                ref={inputRef}
                type="text"
                className="df-prompt-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={promptPlaceholder}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inputValue.trim()) {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
              />
            </div>
          )}
        </div>

        <div className="df-confirm-modal-footer">
          <button
            type="button"
            className="df-confirm-btn-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`df-confirm-btn-submit ${danger ? "df-btn--danger" : "df-btn--primary"}`}
            onClick={handleConfirm}
            disabled={isLoading || (isPrompt && !inputValue.trim())}
          >
            {isLoading ? "Đang xử lý…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? ReactDOM.createPortal(content, document.body) : content;
};

export default ConfirmModal;
