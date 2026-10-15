import mongoose from "mongoose";
import { Branch, Merchant, Restaurant } from "../models/index.cjs";
import AppError from "../utils/AppError.js";
import { recordAudit } from "../utils/auditLog.js";
import { generateUniqueSlug } from "./merchantService.js";
import legacyMapping from "../utils/legacyBranchMapping.cjs";

const { deriveBranchId, buildMerchantDocument, buildBranchDocument } = legacyMapping;
const privateSelect = "+droneDeliveryApplication";

/** Map one authorized legacy restaurant without migrating its dependent data or role. */
export const ensureLegacyBranch = async (restaurant) => {
  const existing = await Merchant.findOne({ $or: [{ _id: restaurant._id }, { legacyRestaurantId: restaurant._id }] });
  if (existing && String(existing.ownerUserId) !== String(restaurant.owner)) {
    throw new AppError("Dữ liệu chủ nhà hàng không khớp với thương hiệu", 409);
  }
  let merchant = existing;
  if (!merchant) {
    const slug = await generateUniqueSlug(`${restaurant.name}-${restaurant._id}`);
    try {
      merchant = await Merchant.findOneAndUpdate(
        { _id: restaurant._id, ownerUserId: restaurant.owner },
        { $setOnInsert: buildMerchantDocument(restaurant, slug) },
        { upsert: true, new: true, runValidators: true, timestamps: false }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      merchant = await Merchant.findById(restaurant._id);
      if (!merchant || String(merchant.ownerUserId) !== String(restaurant.owner)) {
        throw new AppError("Nhà hàng không thể ánh xạ vào thương hiệu hiện tại", 409);
      }
    }
  }
  const main = await Branch.findOne({ merchantId: merchant._id, code: "MAIN" });
  if (main) return main;
  const branchId = deriveBranchId(restaurant._id);
  try {
    return await Branch.findOneAndUpdate(
      { _id: branchId, merchantId: merchant._id, code: "MAIN" },
      { $setOnInsert: { ...buildBranchDocument(restaurant, merchant._id, branchId), droneDeliveryEnabled: false } },
      { upsert: true, new: true, runValidators: true, timestamps: false }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    const branch = await Branch.findOne({ merchantId: merchant._id, code: "MAIN" });
    if (!branch) throw new AppError("Định danh chi nhánh chính bị xung đột", 409);
    return branch;
  }
};

/** Return only the locations owned by or assigned to the current user. */
export const listManagedBranches = async (user) => {
  const restaurants = await Restaurant.find({ owner: user._id });
  for (const restaurant of restaurants) await ensureLegacyBranch(restaurant);
  const merchants = await Merchant.find({ ownerUserId: user._id }).select("_id");
  return Branch.find({ $or: [{ merchantId: { $in: merchants.map((m) => m._id) } }, { managerUserIds: user._id }] })
    .select(privateSelect).populate("merchantId", "name type").sort({ createdAt: 1 });
};

/** Read the private application after branch access has been authorized. */
export const getApplication = async (branchId) => {
  const branch = await Branch.findById(branchId).select(privateSelect);
  if (!branch) throw new AppError("Chi nhánh không tồn tại", 404);
  return branch;
};

/** Atomically submit an initial or corrected rejected application. */
export const submitApplication = async (branchId, profile, actor) => {
  const application = {
    address: { text: profile.address.text, lat: profile.address.lat, lng: profile.address.lng },
    contactName: profile.contactName,
    contactPhone: profile.contactPhone,
    handoverNotes: profile.handoverNotes,
    status: "pending",
    submissionId: new mongoose.Types.ObjectId(),
    submittedBy: actor._id,
    submittedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
    reviewReason: "",
  };
  const branch = await Branch.findOneAndUpdate(
    { _id: branchId, $or: [
      { "droneDeliveryApplication.status": { $in: ["not_registered", "rejected"] } },
      { "droneDeliveryApplication.status": { $exists: false } },
    ] },
    { $set: { droneDeliveryApplication: application, droneDeliveryEnabled: false } },
    { new: true, runValidators: true }
  ).select(privateSelect);
  if (!branch) throw new AppError("Hồ sơ đang chờ duyệt hoặc đã được duyệt, không thể gửi lại", 409);
  await recordAudit({ actor, action: "branch.drone_application_submitted", targetType: "branch", targetId: branch._id,
    merchantId: branch.merchantId, branchId: branch._id, reason: "Gửi hồ sơ đăng ký giao hàng bằng drone",
    metadata: { submissionId: application.submissionId } });
  return branch;
};

/** Review only the exact pending submission, preventing duplicate or stale decisions. */
export const decideApplication = async (branchId, { submissionId, decision, reason }, actor) => {
  if (actor.role !== "admin") throw new AppError("Chỉ quản trị viên được xét duyệt hồ sơ", 403);
  const branch = await Branch.findOneAndUpdate(
    { _id: branchId, "droneDeliveryApplication.status": "pending", "droneDeliveryApplication.submissionId": submissionId },
    { $set: {
      "droneDeliveryApplication.status": decision,
      "droneDeliveryApplication.reviewedBy": actor._id,
      "droneDeliveryApplication.reviewedAt": new Date(),
      "droneDeliveryApplication.reviewReason": reason,
      droneDeliveryEnabled: false,
    } },
    { new: true, runValidators: true }
  ).select(privateSelect);
  if (!branch) throw new AppError("Hồ sơ đã thay đổi hoặc đã được xét duyệt, vui lòng tải lại", 409);
  await recordAudit({ actor, action: `branch.drone_application_${decision}`, targetType: "branch", targetId: branch._id,
    merchantId: branch.merchantId, branchId: branch._id, reason, metadata: { submissionId } });
  return branch;
};
