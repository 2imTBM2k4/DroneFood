import mongoose from "mongoose";
import bcrypt from "bcrypt";
import AppError from "../utils/AppError.js";
import { recordAudit } from "../utils/auditLog.js";
import * as branchRepo from "../repositories/branchRepository.js";
import * as merchantRepo from "../repositories/merchantRepository.js";
import { User, Branch } from "../models/index.cjs";
import {
  DEFAULT_SEARCH_RADIUS_KM,
  MAX_SEARCH_RADIUS_KM,
  MIN_SEARCH_RADIUS_KM,
} from "../config/delivery.js";

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Danh sách chi nhánh cho admin/public legacy endpoint.
 */
export const listBranches = async ({
  merchantId,
  status,
  droneDeliveryEnabled,
  q,
  page,
  limit,
  sortBy,
  order,
} = {}) => {
  const filter = {};
  if (merchantId) {
    const { Merchant } = await import("../models/index.cjs");
    const m = await Merchant.findOne({
      $or: [{ _id: merchantId }, { legacyRestaurantId: merchantId }],
    });
    filter.merchantId = m ? m._id : merchantId;
  }
  if (status) filter.status = status;
  if (droneDeliveryEnabled !== undefined) {
    filter.droneDeliveryEnabled = droneDeliveryEnabled;
  }

  return await branchRepo.findAll(filter, {
    page,
    limit,
    q: q ? escapeRegex(q.trim()) : "",
    sortBy,
    order,
  });
};

/**
 * Tìm các chi nhánh gần nhất và nhóm theo Merchant.
 *
 * @param {Object} params
 * @param {number} params.lat - Vĩ độ của khách hàng
 * @param {number} params.lng - Kinh độ của khách hàng
 * @param {number} [params.radiusKm] - Bán kính tìm kiếm (km)
 * @param {number} [params.limit=50] - Giới hạn số lượng kết quả
 * @returns {Promise<Array<{ merchant: Object, nearestBranch: Object, distance: number, otherBranches: Array }>>}
 */
export const resolveNearestBranches = async ({
  lat,
  lng,
  radiusKm,
  limit = 50,
}) => {
  const numericLat = Number(lat);
  const numericLng = Number(lng);

  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(numericLat) ||
    !Number.isFinite(numericLng)
  ) {
    throw new AppError("Tọa độ lat, lng là bắt buộc và phải là số hợp lệ", 400);
  }

  if (Math.abs(numericLat) > 90 || Math.abs(numericLng) > 180) {
    throw new AppError("Tọa độ lat, lng không nằm trong dải hợp lệ", 400);
  }

  const parsedRadius =
    radiusKm != null && !Number.isNaN(Number(radiusKm))
      ? Number(radiusKm)
      : DEFAULT_SEARCH_RADIUS_KM;

  const clampedRadiusKm = Math.min(
    Math.max(parsedRadius, MIN_SEARCH_RADIUS_KM),
    MAX_SEARCH_RADIUS_KM
  );

  const maxSearchDistanceMeters = MAX_SEARCH_RADIUS_KM * 1000;
  const requestedRadiusMeters = clampedRadiusKm * 1000;

  const candidates = await branchRepo.findNearbyBranchesWithMerchant({
    lat: numericLat,
    lng: numericLng,
    maxDistanceMeters: maxSearchDistanceMeters,
  });

  const filteredCandidates = candidates.filter((candidate) => {
    if (candidate.distance > requestedRadiusMeters) return false;
    if (
      candidate.deliveryRadiusKm != null &&
      candidate.distance > candidate.deliveryRadiusKm * 1000
    ) {
      return false;
    }
    return true;
  });

  const merchantGroups = new Map();

  for (const candidate of filteredCandidates) {
    const merchantIdStr = candidate.merchant._id.toString();
    const { merchant, distance, ...branchOnly } = candidate;

    if (!merchantGroups.has(merchantIdStr)) {
      merchantGroups.set(merchantIdStr, {
        merchant,
        nearestBranch: branchOnly,
        distance,
        otherBranches: [],
      });
    } else {
      merchantGroups.get(merchantIdStr).otherBranches.push(branchOnly);
    }
  }

  const results = Array.from(merchantGroups.values())
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Number(limit) || 50);

  return results;
};

/**
 * Đồng bộ số lượng chi nhánh đang hoạt động (active) và kiểu (individual/brand) của Merchant.
 *
 * @param {string|mongoose.Types.ObjectId} merchantId
 * @returns {Promise<Object>} Merchant sau khi cập nhật
 */
export const syncMerchantBranchCount = async (merchantId) => {
  const activeBranchCount = await branchRepo.countActiveByMerchantId(merchantId);

  if (activeBranchCount === 0) {
    console.warn(`[syncMerchantBranchCount] Merchant ${merchantId} có 0 chi nhánh active`);
    return await merchantRepo.updateById(merchantId, { branchCount: 0 });
  }

  const newType = activeBranchCount > 1 ? "brand" : "individual";

  return await merchantRepo.updateById(merchantId, {
    branchCount: activeBranchCount,
    type: newType,
  });
};

/**
 * Kiểm tra xem chi nhánh và thương hiệu có đang hoạt động để nhận đơn không.
 *
 * @param {string|mongoose.Types.ObjectId} branchId
 * @returns {Promise<{ branch: Object, merchant: Object }>}
 */
export const assertBranchOperational = async (branchId) => {
  if (!branchId || !mongoose.Types.ObjectId.isValid(branchId)) {
    throw new AppError("Chi nhánh không tồn tại", 404);
  }

  const branch = await branchRepo.findById(branchId);
  if (!branch) {
    throw new AppError("Chi nhánh không tồn tại", 404);
  }

  if (branch.status !== "active") {
    throw new AppError("Chi nhánh không hoạt động", 403);
  }

  if (!branch.isOpen) {
    throw new AppError("Chi nhánh đang đóng cửa", 403);
  }

  const merchant = await merchantRepo.findById(branch.merchantId);
  if (!merchant || merchant.status !== "active") {
    throw new AppError("Thương hiệu chưa được duyệt hoặc đã bị đình chỉ", 403);
  }

  return { branch, merchant };
};

/**
 * Tạo chi nhánh mới cho Merchant.
 */
export const createBranch = async (merchantId, branchData, actorUser) => {
  const merchant = await merchantRepo.findById(merchantId);
  if (!merchant) {
    throw new AppError("Merchant không tồn tại", 404);
  }
  if (merchant.status !== "active") {
    throw new AppError("Thương hiệu chưa được duyệt", 403);
  }

  const status = branchData.status || "active";

  let addressObj = {};
  if (typeof branchData.address === "string") {
    addressObj = { text: branchData.address };
  } else if (branchData.address && typeof branchData.address === "object") {
    addressObj = {
      text: branchData.address.text || branchData.address.address || "",
      lat: branchData.address.lat ?? null,
      lng: branchData.address.lng ?? null,
    };
  }

  let location = branchData.location;
  if (!location && addressObj.lat != null && addressObj.lng != null) {
    location = { type: "Point", coordinates: [Number(addressObj.lng), Number(addressObj.lat)] };
  }

  const branch = await branchRepo.create({
    ...branchData,
    merchantId,
    status,
    address: addressObj,
    ...(location ? { location } : {}),
  });

  await syncMerchantBranchCount(merchantId);

  await recordAudit({
    actor: actorUser,
    action: "branch.create",
    targetType: "branch",
    targetId: branch._id,
    merchantId,
    branchId: branch._id,
    reason: "Tạo chi nhánh mới",
    metadata: { name: branch.name, code: branch.code },
  });

  return branch;
};

/**
 * Cập nhật thông tin chi nhánh.
 */
export const updateBranch = async (branchId, updates, actorUser) => {
  const normalizedUpdates = { ...updates };
  if (typeof normalizedUpdates.address === "string") {
    normalizedUpdates.address = {
      text: normalizedUpdates.address,
      lat: null,
      lng: null,
    };
  }
  const branch = await branchRepo.updateById(branchId, normalizedUpdates);
  if (!branch) {
    throw new AppError("Chi nhánh không tồn tại", 404);
  }

  if (updates.status) {
    await syncMerchantBranchCount(branch.merchantId);
  }

  await recordAudit({
    actor: actorUser,
    action: "branch.update",
    targetType: "branch",
    targetId: branch._id,
    merchantId: branch.merchantId,
    branchId: branch._id,
    reason: "Cập nhật thông tin chi nhánh",
    metadata: updates,
  });

  return branch;
};

/**
 * Đóng hoặc mở chi nhánh.
 */
export const setBranchOpenState = async (branchId, isOpen, actorUser) => {
  const branch = await branchRepo.updateById(branchId, { isOpen });
  if (!branch) {
    throw new AppError("Chi nhánh không tồn tại", 404);
  }

  await recordAudit({
    actor: actorUser,
    action: "branch.open_state",
    targetType: "branch",
    targetId: branch._id,
    merchantId: branch.merchantId,
    branchId: branch._id,
    reason: isOpen ? "Mở cửa chi nhánh" : "Đóng cửa chi nhánh",
    metadata: { isOpen },
  });

  return branch;
};

/**
 * Xóa chi nhánh (chặn xóa nếu là chi nhánh cuối cùng).
 */
export const deleteBranch = async (branchId, actorUser) => {
  const branch = await branchRepo.findById(branchId);
  if (!branch) {
    throw new AppError("Chi nhánh không tồn tại", 404);
  }

  const totalBranches = await branchRepo.countByMerchantId(branch.merchantId);
  if (totalBranches <= 1) {
    throw new AppError("Không thể xóa chi nhánh duy nhất của merchant", 400);
  }

  await branchRepo.deleteById(branchId);
  await syncMerchantBranchCount(branch.merchantId);

  await recordAudit({
    actor: actorUser,
    action: "branch.delete",
    targetType: "branch",
    targetId: branchId,
    merchantId: branch.merchantId,
    branchId,
    reason: "Xóa chi nhánh",
    metadata: { code: branch.code, name: branch.name },
  });

  return { success: true, message: "Chi nhánh đã được xóa" };
};

/**
 * Khóa hoặc mở khóa chi nhánh (Admin).
 */
export const lockBranch = async (branchId, isLocked, actorUser, bodyReason = "") => {
  const status = isLocked ? "locked" : "active";
  const reason = bodyReason?.trim() || (
    isLocked ? "Admin khóa chi nhánh" : "Admin mở khóa chi nhánh"
  );
  const branch = await branchRepo.updateById(branchId, { status });
  if (!branch) {
    throw new AppError("Chi nhánh không tồn tại", 404);
  }

  await syncMerchantBranchCount(branch.merchantId);

  await recordAudit({
    actor: actorUser,
    action: isLocked ? "branch.lock" : "branch.unlock",
    targetType: "branch",
    targetId: branchId,
    merchantId: branch.merchantId,
    branchId,
    reason,
    metadata: { status },
  });

  return branch;
};

/**
 * Gán quản lý cho chi nhánh (mỗi chi nhánh tối đa 1 quản lý, mỗi quản lý chỉ phụ trách 1 chi nhánh).
 */
export const assignBranchManagers = async (branchId, managerUserIds, actorUser) => {
  if (Array.isArray(managerUserIds) && managerUserIds.length > 1) {
    throw new AppError("Mỗi chi nhánh chỉ được có tối đa 1 quản lý", 400);
  }

  const branch = await branchRepo.findById(branchId);
  if (!branch) {
    throw new AppError("Chi nhánh không tồn tại", 404);
  }

  const newManagerId =
    managerUserIds && managerUserIds.length > 0
      ? managerUserIds[0].toString()
      : null;
  const oldManagerIds = (branch.managerUserIds || []).map((id) =>
    id.toString()
  );

  if (newManagerId) {
    const user = await User.findById(newManagerId);
    if (!user) {
      throw new AppError("Người dùng không tồn tại", 404);
    }
    if (user.role === "admin") {
      throw new AppError("Không thể gán quản trị viên làm quản lý chi nhánh", 400);
    }

    const conflictBranch = await Branch.findOne({
      _id: { $ne: branchId },
      managerUserIds: newManagerId,
    });
    if (conflictBranch) {
      throw new AppError(
        `Người dùng này đã là quản lý của chi nhánh "${conflictBranch.name}". Một quản lý chỉ được quản lý 1 chi nhánh`,
        409
      );
    }

    if (user.role === "user") {
      await User.findByIdAndUpdate(newManagerId, { role: "branch_manager" });
    }
  }

  // Khi gỡ bỏ hoặc thay thế quản lý cũ, hạ vai trò về user nếu họ không còn quản lý chi nhánh nào khác
  for (const oldId of oldManagerIds) {
    if (oldId !== newManagerId) {
      const otherManagedCount = await Branch.countDocuments({
        _id: { $ne: branchId },
        managerUserIds: oldId,
      });
      if (otherManagedCount === 0) {
        const oldUser = await User.findById(oldId);
        if (oldUser && oldUser.role === "branch_manager") {
          await User.findByIdAndUpdate(oldId, { role: "user" });
        }
      }
    }
  }

  const updatedBranch = await branchRepo.updateById(branchId, {
    managerUserIds: newManagerId ? [newManagerId] : [],
  });

  await recordAudit({
    actor: actorUser,
    action: "branch.assign_managers",
    targetType: "branch",
    targetId: branchId,
    merchantId: branch.merchantId,
    branchId,
    reason: newManagerId ? "Gán quản lý chi nhánh" : "Gỡ bỏ quản lý chi nhánh",
    metadata: { managerUserIds: newManagerId ? [newManagerId] : [] },
  });

  return updatedBranch;
};

/**
 * Tạo mới tài khoản và bổ nhiệm làm quản lý chi nhánh.
 * Ràng buộc: Mỗi chi nhánh chỉ được có tối đa 1 quản lý.
 */
export const createAndAssignBranchManager = async (branchId, managerData, actorUser) => {
  const { name, email, password, phone } = managerData;

  const branch = await branchRepo.findById(branchId);
  if (!branch) {
    throw new AppError("Chi nhánh không tồn tại", 404);
  }

  // Ràng buộc: Mỗi chi nhánh chỉ có tối đa 1 quản lý
  if (Array.isArray(branch.managerUserIds) && branch.managerUserIds.length > 0) {
    throw new AppError("Chi nhánh này đã có quản lý. Vui lòng gỡ bỏ quản lý hiện tại trước khi tạo mới", 400);
  }

  // Kiểm tra email đã tồn tại chưa
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("Email này đã được sử dụng bởi một tài khoản khác trong hệ thống", 409);
  }

  // Băm mật khẩu
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Tạo người dùng mới với vai trò branch_manager
  const newUser = await User.create({
    name,
    email,
    password: hashedPassword,
    phone: phone || undefined,
    role: "branch_manager",
    isEmailVerified: true, // Kích hoạt ngay vì được chủ thương hiệu tạo
  });

  // Gán vào chi nhánh
  const updatedBranch = await branchRepo.updateById(branchId, {
    managerUserIds: [newUser._id],
  });

  await recordAudit({
    actor: actorUser,
    action: "branch.create_manager",
    targetType: "branch",
    targetId: branchId,
    merchantId: branch.merchantId,
    branchId,
    reason: "Tạo mới tài khoản và gán làm quản lý chi nhánh",
    metadata: {
      managerUserId: newUser._id,
      email: newUser.email,
      name: newUser.name,
    },
  });

  return {
    branch: updatedBranch,
    manager: {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone,
    },
  };
};

/**
 * Bật/tắt dịch vụ giao hàng bằng drone cho chi nhánh.
 */
export const setDroneDelivery = async (branchId, enabled, actorUser) => {
  const { Branch } = await import("../models/index.cjs");
  const branch = await Branch.findOneAndUpdate(
    { _id: branchId, ...(enabled && { "droneDeliveryApplication.status": "approved" }) },
    { $set: { droneDeliveryEnabled: Boolean(enabled) } },
    { new: true, runValidators: true }
  );
  if (!branch) {
    if (!(await Branch.exists({ _id: branchId }))) throw new AppError("Chi nhánh không tồn tại", 404);
    throw new AppError("Chi nhánh chưa được duyệt giao hàng bằng drone", 403);
  }

  await recordAudit({
    actor: actorUser,
    action: "branch.drone_delivery_toggle",
    targetType: "branch",
    targetId: branch._id,
    merchantId: branch.merchantId,
    branchId: branch._id,
    reason: enabled ? "Bật giao hàng drone" : "Tắt giao hàng drone",
    metadata: { droneDeliveryEnabled: Boolean(enabled) },
  });

  return branch;
};
