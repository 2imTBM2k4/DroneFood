import React from "react";
import "./StateBlock.css";

/**
 * Empty and error states, shared by all three frontends. Styling rides on the
 * tokens in shared/tokens.css, so each app inherits its own theme.
 *
 * NOTE: files under shared/ can only import `react` — Vite dedupes that one,
 * but every other package lives in each app's own node_modules and will not
 * resolve from here. Hence the inline SVGs below instead of lucide-react.
 * Callers may still pass their own lucide icon component via `icon`.
 */

const AlertIcon = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const RetryIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <polyline points="21 3 21 9 15 9" />
  </svg>
);

/**
 * EmptyState — a nothing-here message that always offers a way out.
 * Pass an icon component (e.g. from lucide-react) as `icon`.
 */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="state-block">
    {Icon && (
      <span className="state-icon">
        <Icon size={26} strokeWidth={1.5} />
      </span>
    )}
    <h3 className="state-title">{title}</h3>
    {description && <p className="state-desc">{description}</p>}
    {actionLabel && onAction && (
      <button className="ds-btn state-action" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

/**
 * ErrorState — same shape, but framed as a failure and wired to a retry.
 * `onRetry` should re-run the fetch that failed.
 */
export const ErrorState = ({
  title = "Something went wrong",
  description,
  onRetry,
  retryLabel = "Try again",
  actionLabel,
  onAction,
}) => (
  <div className="state-block state-block-error">
    <span className="state-icon state-icon-error">
      <AlertIcon />
    </span>
    <h3 className="state-title">{title}</h3>
    {description && <p className="state-desc">{description}</p>}
    <div className="state-actions">
      {onRetry && (
        <button className="ds-btn state-action" onClick={onRetry}>
          <RetryIcon />
          {retryLabel}
        </button>
      )}
      {actionLabel && onAction && (
        <button className="ds-btn quiet state-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  </div>
);

export default EmptyState;
