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
    // Autoplay policies can reject audio until the user has interacted. The
    // visual, persisted notification remains the reliable delivery channel.
  }
};

const NotificationBell = ({ apiUrl, token, connectRealtime, navigate, soundForNewOrder = false }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [liveMessage, setLiveMessage] = useState("");
  const rootRef = useRef(null);
  const audioUnlockedRef = useRef(false);

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
      setLiveMessage(`Thông báo mới: ${notification.title}. ${notification.body}`);
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

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const markRead = async (notification) => {
    if (notification.readAt) return;
    try {
      const updated = await request(`/${notification._id}/read`, { method: "POST" });
      setItems((current) => current.map((item) => item._id === updated._id ? updated : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) { setError(err.message || "Không thể cập nhật thông báo"); }
  };

  const openNotification = async (notification) => {
    await markRead(notification);
    setOpen(false);
    const path = notification.data?.path;
    if (path && path.startsWith("/")) navigate?.(path);
  };

  const markAllRead = async () => {
    try {
      await request("/read-all", { method: "POST" });
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) { setError(err.message || "Không thể đánh dấu đã đọc"); }
  };

  if (!token) return null;
  return (
    <div className="notification-bell" ref={rootRef}>
      <span className="notification-live-status" role="status" aria-atomic="true">{liveMessage}</span>
      <button type="button" className="notification-trigger" onClick={() => setOpen((value) => !value)} aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"} aria-expanded={open} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
        {unreadCount > 0 && <span className="notification-count" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-panel" role="dialog" aria-label="Thông báo">
          <header className="notification-panel-header"><h2>Thông báo</h2>{unreadCount > 0 && <button type="button" onClick={markAllRead}>Đọc tất cả</button>}</header>
          {loading ? <p className="notification-state">Đang tải…</p> : error ? <div className="notification-state notification-error"><p>{error}</p><button type="button" onClick={refresh}>Thử lại</button></div> : items.length === 0 ? <p className="notification-state">Bạn chưa có thông báo nào.</p> : <ul className="notification-list">
            {items.map((notification) => <li key={notification._id} className={notification.readAt ? "" : "is-unread"}><button type="button" onClick={() => openNotification(notification)}><span className="notification-item-main"><strong>{notification.title}</strong><span>{notification.body}</span><time dateTime={notification.createdAt}>{timeLabel(notification.createdAt)}</time></span>{!notification.readAt && <span className="notification-unread-dot" aria-label="Chưa đọc" />}</button></li>)}
          </ul>}
        </section>
      )}
    </div>
  );
};

export default NotificationBell;
