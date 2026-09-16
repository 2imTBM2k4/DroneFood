import { Notification } from "../models/index.cjs";

export const createOnce = async (draft) => {
  // An atomic upsert gives the correct result even before Mongo has finished
  // building the defensive unique index on a fresh deployment.
  const result = await Notification.findOneAndUpdate(
    { recipient: draft.recipient, eventKey: draft.eventKey },
    { $setOnInsert: draft },
    { upsert: true, new: true, includeResultMetadata: true }
  );
  return { notification: result.value, created: !result.lastErrorObject?.updatedExisting };
};

export const listForRecipient = async (recipient, { page = 1, limit = 20 } = {}) => {
  const filter = { recipient };
  const [data, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
};

export const unreadCountForRecipient = (recipient) => Notification.countDocuments({ recipient, readAt: null });

export const markRead = (recipient, id) => Notification.findOneAndUpdate(
  { _id: id, recipient, readAt: null },
  { $set: { readAt: new Date() } },
  { new: true }
).lean();

export const markAllRead = async (recipient) => {
  const result = await Notification.updateMany({ recipient, readAt: null }, { $set: { readAt: new Date() } });
  return result.modifiedCount;
};
