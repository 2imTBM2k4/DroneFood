import { Voucher, VoucherRedemption, VoucherUserUsage } from "../models/index.cjs";
import AppError from "../utils/AppError.js";

export const create = (data) => Voucher.create(data);

export const findByCode = (code) => Voucher.findOne({ code: String(code).trim().toUpperCase() });

export const findById = (id) => Voucher.findById(id);

export const findAll = async ({ page = 1, limit = 20, enabled } = {}) => {
  const filter = enabled === undefined ? {} : { enabled };
  const [data, total] = await Promise.all([
    Voucher.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Voucher.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const updateById = async (id, changes) => {
  const voucher = await Voucher.findById(id);
  if (!voucher) return null;
  Object.assign(voucher, changes);
  return voucher.save();
};

export const reserveForOrder = async ({ voucher, userId, orderId, discountAmount }, session) => {
  const now = new Date();
  const globalCounter = await Voucher.findOneAndUpdate(
    {
      _id: voucher._id,
      enabled: true,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
      $expr: { $lt: ["$usageCount", "$totalQuota"] },
    },
    { $inc: { usageCount: 1 } },
    { new: true, session }
  );
  if (!globalCounter) throw new AppError("Voucher is unavailable or quota has been used", 409);

  try {
    const userCounter = await VoucherUserUsage.findOneAndUpdate(
      { voucher: voucher._id, user: userId, activeCount: { $lt: voucher.perUserQuota } },
      { $inc: { activeCount: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true, session }
    );
    if (!userCounter || userCounter.activeCount > voucher.perUserQuota) {
      throw new AppError("You have reached this voucher's usage limit", 409);
    }
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("You have reached this voucher's usage limit", 409);
    }
    throw error;
  }

  await VoucherRedemption.create(
    [{ voucher: voucher._id, user: userId, order: orderId, discountAmount }],
    { session }
  );
};

export const releaseForOrder = async (orderId, reason, session) => {
  const redemptions = await VoucherRedemption.find({ order: orderId, status: "reserved" }).session(session || null);
  if (!redemptions || redemptions.length === 0) return false;

  for (const redemption of redemptions) {
    redemption.status = "released";
    redemption.releasedAt = new Date();
    redemption.releaseReason = reason;
    await redemption.save({ session });

    await Promise.all([
      Voucher.updateOne({ _id: redemption.voucher, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } }, { session }),
      VoucherUserUsage.updateOne(
        { voucher: redemption.voucher, user: redemption.user, activeCount: { $gt: 0 } },
        { $inc: { activeCount: -1 } },
        { session }
      ),
    ]);
  }
  return true;
};
