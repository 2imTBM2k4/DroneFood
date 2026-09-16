import React from "react";
import { toast } from "react-toastify";
import ToastNotification from "../components/ToastNotification";

/**
 * Normalizes input arguments so callers can provide either:
 * - A string: notify.info("Password contain letter from A to Z!")
 * - An object: notify.info({ title: "Must Have A-Z!", message: "...", actionText: "Learn More" })
 * - A string with options: notify.info("Message", { title: "Custom Title", actionText: "Action" })
 */
const renderToastContent = (type, content, options = {}) => {
  let title = options.title;
  let message = "";
  let actionText = options.actionText;
  let onAction = options.onAction;
  let secondaryActionText = options.secondaryActionText;
  let onSecondaryAction = options.onSecondaryAction;

  if (typeof content === "string") {
    message = content;
  } else if (content && typeof content === "object") {
    if (React.isValidElement(content)) {
      return content;
    }
    title = content.title ?? title;
    message = content.message ?? content.text ?? "";
    actionText = content.actionText ?? actionText;
    onAction = content.onAction ?? onAction;
    secondaryActionText = content.secondaryActionText ?? secondaryActionText;
    onSecondaryAction = content.onSecondaryAction ?? onSecondaryAction;
  }

  return ({ closeToast }) => (
    <ToastNotification
      type={type}
      title={title}
      message={message}
      actionText={actionText}
      onAction={onAction}
      secondaryActionText={secondaryActionText}
      onSecondaryAction={onSecondaryAction}
      closeToast={closeToast}
    />
  );
};

const createNotifyFunction = (type) => {
  return (content, options = {}) => {
    const isCustom = typeof content === "object" && !React.isValidElement(content);
    const toastOpts = {
      type,
      position: options.position || "bottom-center",
      icon: false, // We render the custom squircle badge inside ToastNotification
      autoClose: options.autoClose ?? 4500,
      hideProgressBar: options.hideProgressBar ?? false,
      closeOnClick: options.closeOnClick ?? (isCustom && content.actionText ? false : true),
      pauseOnHover: options.pauseOnHover ?? false,
      draggable: options.draggable ?? true,
      ...options,
    };

    return toast(renderToastContent(type, content, options), toastOpts);
  };
};

export const notify = (content, options = {}) => {
  const type = options.type || (typeof content === "object" ? content.type : "info") || "info";
  return createNotifyFunction(type)(content, options);
};

notify.info = createNotifyFunction("info");
notify.success = createNotifyFunction("success");
notify.warning = createNotifyFunction("warning");
notify.warn = createNotifyFunction("warning");
notify.error = createNotifyFunction("error");
notify.dismiss = toast.dismiss;

export { toast };
export default notify;
