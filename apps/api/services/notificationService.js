import AppError from "../utils/AppError.js";
import * as notificationRepo from "../repositories/notificationRepository.js";
import * as pushTokenRepo from "../repositories/expoPushTokenRepository.js";

const ROLES = new Set(["user", "restaurant_owner", "shipper", "admin"]);

const roomFor = ({ recipient, role }) => {
  if (role === "restaurant_owner") return `restaurant_owner_${recipient}`;
  return `${role}_${recipient}`;
};

const realtimePayload = (notification) => ({
  _id: String(notification._id),
  type: notification.type,
  title: notification.title,
  body: notification.body,
  data: notification.data || {},
  readAt: notification.readAt,
  createdAt: notification.createdAt,
});

const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
  items.slice(index * size, (index + 1) * size)
);

const sendExpoPush = async (notification) => {
  const devices = await pushTokenRepo.listForUser(notification.recipient);
  if (!devices.length) return;

  const messages = devices.map(({ token }) => ({
    to: token,
    sound: "default",
    priority: "high",
    channelId: "default",
    title: notification.title,
    body: notification.body,
    // This is deliberately limited to the same navigation-safe data that is
    // stored in the inbox. Do not put wallet balances or bank data on a lock
    // screen payload.
    data: notification.data || {},
  }));

  const invalidTokens = [];
  for (const batch of chunk(messages, 100)) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });
    if (!response.ok) throw new Error(`Expo Push Service returned ${response.status}`);
    const payload = await response.json();
    (payload.data || []).forEach((ticket, index) => {
      if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered") {
        invalidTokens.push(batch[index].to);
      }
    });
  }
  if (invalidTokens.length) await pushTokenRepo.removeTokens(invalidTokens);
};

export const createAndEmit = async (io, draft) => {
  if (!draft?.recipient || !ROLES.has(draft.role) || !draft.eventKey) {
    throw new AppError("Invalid notification recipient or event", 500);
  }
  const { notification, created } = await notificationRepo.createOnce(draft);
  if (created) {
    if (io) io.to(roomFor(draft)).emit("notificationCreated", realtimePayload(notification));
    // Push delivery is never allowed to turn a completed order or ledger
    // mutation into a failed request. Notification persistence remains the
    // durable inbox/retry boundary.
    sendExpoPush(notification).catch((error) => console.error("Expo push delivery failed:", error.message));
  }
  return { notification, created };
};

export const listMine = async (user, query) => notificationRepo.listForRecipient(user._id, query);
export const unreadCountMine = async (user) => ({ count: await notificationRepo.unreadCountForRecipient(user._id) });

export const markMineRead = async (user, id) => {
  const notification = await notificationRepo.markRead(user._id, id);
  if (!notification) throw new AppError("Notification not found or already read", 404);
  return notification;
};

export const markAllMineRead = async (user) => ({ count: await notificationRepo.markAllRead(user._id) });
