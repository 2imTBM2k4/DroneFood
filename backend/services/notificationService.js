import AppError from "../utils/AppError.js";
import * as notificationRepo from "../repositories/notificationRepository.js";

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

export const createAndEmit = async (io, draft) => {
  if (!draft?.recipient || !ROLES.has(draft.role) || !draft.eventKey) {
    throw new AppError("Invalid notification recipient or event", 500);
  }
  const { notification, created } = await notificationRepo.createOnce(draft);
  if (created && io) io.to(roomFor(draft)).emit("notificationCreated", realtimePayload(notification));
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
