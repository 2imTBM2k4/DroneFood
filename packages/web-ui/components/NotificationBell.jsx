import React, { useCallback, useEffect, useRef, useState } from "react";
import "./NotificationBell.css";

const timeLabel = (value) => {
  const time = new Date(value).getTime();
  const diff = Math.max(0, Date.now() - time);
  if (diff < 60_000) return "Vừa xong";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
};

const playSound = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    oscillator.addEventListener("ended", () => context.close());
  } catch {
    // Autoplay policies can reject audio until the user has interacted.
  }
};

const NotificationBell = ({ apiUrl, token, connectRealtime, navigate, soundForNewOrder = false }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef(null);
  const triggerBtnRef = useRef(null);
  const panelRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const announceTimer = useRef(null);

  // NTF-020: Debounce live region >= 500ms and only announce when changed
  useEffect(() => {
    if (announceTimer.current) clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => {
      const msg = unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : "Không có thông báo chưa đọc";
      setAnnouncement((prev) => (prev !== msg ? msg : prev));
    }, 500);

    return () => {
      if (announceTimer.current) clearTimeout(announceTimer.current);
    };
  }, [unreadCount]);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiUrl}/api/notifications${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || "Không thể tải thông báo");
    return payload.data;
  }, [apiUrl, token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [list, unread] = await Promise.all([request("?page=1&limit=20"), request("/unread-count")]);
      setItems(list.data || []);
      setUnreadCount(unread.count || 0);
    } catch (err) {
      setError(err.message || "Không thể tải thông báo");
    } finally {
      setLoading(false);
    }
  }, [request, token]);

  useEffect(() => {
    if (!token) return undefined;
    refresh();
    const unlockAudio = () => { audioUnlockedRef.current = true; };
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    const socket = connectRealtime?.();
    socket?.emit("joinNotifications");
    const onCreated = (notification) => {
      setItems((current) => [notification, ...current.filter((item) => item._id !== notification._id)].slice(0, 20));
      setUnreadCount((count) => count + (notification.readAt ? 0 : 1));
      if (announceTimer.current) clearTimeout(announceTimer.current);
      announceTimer.current = setTimeout(() => {
        setAnnouncement(`Thông báo mới: ${notification.title}. ${notification.body}`);
      }, 500);
      if (soundForNewOrder && notification.type === "order.new" && audioUnlockedRef.current) playSound();
    };
    socket?.on("notificationCreated", onCreated);
    socket?.on("connect", () => {
      socket.emit("joinNotifications");
      refresh();
    });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      socket?.off("notificationCreated", onCreated);
      socket?.disconnect();
    };
  }, [connectRealtime, refresh, soundForNewOrder, token]);

  // Focus management, Escape key, and focus trap (NTF-008, NTF-009, NTF-017)
  useEffect(() => {
    if (!open) return undefined;

    // Focus into panel upon opening
    const timer = setTimeout(() => {
      if (panelRef.current) {
        const firstFocusable = panelRef.current.querySelector(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    }, 40);

    const closeOnOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        triggerBtnRef.current?.focus();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerBtnRef.current?.focus();
        return;
      }

      // Focus trap within panel
      if (event.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }

      // NTF-017: Arrow navigation, Home, End, and wrap-around between notification items
      if (
        (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") &&
        panelRef.current
      ) {
        const itemButtons = Array.from(panelRef.current.querySelectorAll(".notification-list button"));
        if (itemButtons.length > 0) {
          if (event.key === "Home") {
            event.preventDefault();
            itemButtons[0]?.focus();
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            itemButtons[itemButtons.length - 1]?.focus();
            return;
          }
          const currentIndex = itemButtons.indexOf(document.activeElement);
          if (currentIndex !== -1) {
            event.preventDefault();
            if (event.key === "ArrowDown") {
              const nextIndex = (currentIndex + 1) % itemButtons.length;
              itemButtons[nextIndex]?.focus();
            } else if (event.key === "ArrowUp") {
              const prevIndex = (currentIndex - 1 + itemButtons.length) % itemButtons.length;
              itemButtons[prevIndex]?.focus();
            }
          }
        }
      }
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const markRead = async (notification) => {
    if (notification.readAt) return;
    try {
      const updated = await request(`/${notification._id}/read`, { method: "POST" });
      setItems((current) => current.map((item) => (item._id === updated._id ? updated : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      setError(err.message || "Không thể cập nhật thông báo");
    }
  };

  const openNotification = async (notification) => {
    await markRead(notification);
    setOpen(false);
    triggerBtnRef.current?.focus();
    const path = notification.data?.path;
    if (path && path.startsWith("/")) navigate?.(path);
  };

  const markAllRead = async () => {
    try {
      await request("/read-all", { method: "POST" });
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      setError(err.message || "Không thể đánh dấu đã đọc");
    }
  };

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (!next) {
        triggerBtnRef.current?.focus();
      }
      return next;
    });
  };

  if (!token) return null;
  return (
    <div className="notification-bell" ref={rootRef}>
      <span className="notification-live-status" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      <button
        ref={triggerBtnRef}
        type="button"
        className="notification-trigger"
        onClick={handleToggle}
        aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          ref={panelRef}
          className="notification-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Trung tâm thông báo"
        >
          <header className="notification-panel-header">
            <h2>Thông báo</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} aria-label="Đánh dấu tất cả thông báo đã đọc">
                Đọc tất cả
              </button>
            )}
          </header>
          {loading ? (
            <p className="notification-state" role="status">Đang tải…</p>
          ) : error ? (
            <div className="notification-state notification-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={refresh}>Thử lại</button>
            </div>
          ) : items.length === 0 ? (
            <p className="notification-state">Bạn chưa có thông báo nào.</p>
          ) : (
            <ul className="notification-list" role="listbox" aria-label="Danh sách thông báo">
              {items.map((notification) => (
                <li key={notification._id} className={notification.readAt ? "" : "is-unread"} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-label={`${notification.title}${!notification.readAt ? " — chưa đọc" : ""}`}
                    onClick={() => openNotification(notification)}
                  >
                    <span className="notification-item-main">
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                      <time dateTime={notification.createdAt}>{timeLabel(notification.createdAt)}</time>
                    </span>
                    {!notification.readAt && <span className="notification-unread-dot" aria-label="Chưa đọc" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

export default NotificationBell;
