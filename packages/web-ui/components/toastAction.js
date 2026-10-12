/**
 * Executes a toast action with guaranteed cleanup order.
 *
 * Order of execution:
 *   1. action.onClick()      — business callback (if function)
 *   2. onAction(action)      — analytics callback (if function)
 *   3. closeToast()          — dismiss the toast (if function)
 *
 * Guarantees:
 *   - If action.onClick throws, onAction and closeToast still run.
 *   - If onAction throws, closeToast still runs.
 *   - Errors from onClick/onAction propagate to the caller after cleanup.
 *     Callers in React event handlers are protected by React's error boundary;
 *     callers outside React must try/catch if they don't want propagation.
 *
 * @param {Object} action - Toast action object. Reads `action.onClick` if present.
 * @param {Function} [onAction] - Analytics callback. Receives the action object.
 * @param {Function} [closeToast] - Dismiss callback. No arguments.
 * @returns {void}
 */
export const runToastAction = (action, onAction, closeToast) => {
  try {
    try {
      if (typeof action?.onClick === "function") {
        action.onClick();
      }
    } finally {
      if (typeof onAction === "function") {
        onAction(action);
      }
    }
  } finally {
    if (typeof closeToast === "function") {
      closeToast();
    }
  }
};
