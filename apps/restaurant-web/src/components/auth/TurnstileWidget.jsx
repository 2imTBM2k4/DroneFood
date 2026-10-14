import { useEffect, useRef } from "react";

const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const loadTurnstile = () => {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  const existingScript = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(window.turnstile), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const TurnstileWidget = ({ action, onToken, onExpired, onError, resetKey = 0 }) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    let active = true;
    loadTurnstile()
      .then((turnstile) => {
        if (!active || !turnstile || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: onToken,
          "expired-callback": onExpired,
          "error-callback": onError,
        });
      })
      .catch(() => onError?.());

    return () => {
      active = false;
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onError, onExpired, onToken, resetKey, siteKey]);

  if (!siteKey) {
    return (
      <p role="alert">
        Không thể tải bước xác minh bảo mật. Vui lòng thử lại sau.
      </p>
    );
  }

  return <div ref={containerRef} aria-label="Xác minh bảo mật" />;
};

export default TurnstileWidget;
