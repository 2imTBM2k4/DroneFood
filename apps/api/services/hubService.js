import mongoose from "mongoose";
import AppError from "../utils/AppError.js";
import { recordAudit } from "../utils/auditLog.js";
import * as hubRepo from "../repositories/hubRepository.js";
import { Drone, Hub } from "../models/index.cjs";
import { haversineKm } from "../utils/distance.js";

export const createHub = async (data, actorUser = null) => {
  if (!data.name || !data.name.trim()) {
    throw new AppError("Tên hub là bắt buộc", 400);
  }
  if (!data.code || !data.code.trim()) {
    throw new AppError("Mã hub là bắt buộc", 400);
  }

  const normalizedCode = data.code.trim().toUpperCase();
  const existing = await hubRepo.findByCode(normalizedCode);
  if (existing) {
    throw new AppError("Mã hub đã tồn tại", 409);
  }

  const lat = data.address?.lat;
  const lng = data.address?.lng;
  const hasCoordinates =
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 &&
    Math.abs(Number(lng)) <= 180;

  const location = hasCoordinates
    ? { type: "Point", coordinates: [Number(lng), Number(lat)] }
    : undefined;

  const hub = await hubRepo.create({
    ...data,
    code: normalizedCode,
    ...(location ? { location } : {}),
  });

  if (actorUser) {
    await recordAudit({
      actor: actorUser,
      action: "hub.create",
      targetType: "hub",
      targetId: hub._id,
      reason: "Tạo Hub drone mới",
      metadata: { code: hub.code, name: hub.name },
    });
  }

  return hub;
};

export const updateHub = async (id, data, actorUser = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("ID hub không hợp lệ", 400);
  }

  const hub = await hubRepo.findById(id);
  if (!hub) {
    throw new AppError("Hub không tồn tại", 404);
  }

  if (data.code && data.code.trim().toUpperCase() !== hub.code) {
    const codeDup = await hubRepo.findByCode(data.code.trim().toUpperCase());
    if (codeDup) {
      throw new AppError("Mã hub đã tồn tại", 409);
    }
    data.code = data.code.trim().toUpperCase();
  }

  if (data.address && (data.address.lat !== undefined || data.address.lng !== undefined)) {
    const lat = data.address.lat ?? hub.address?.lat;
    const lng = data.address.lng ?? hub.address?.lng;
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      data.location = { type: "Point", coordinates: [Number(lng), Number(lat)] };
    }
  }

  const updated = await hubRepo.updateById(id, data);

  if (actorUser) {
    await recordAudit({
      actor: actorUser,
      action: "hub.update",
      targetType: "hub",
      targetId: hub._id,
      reason: "Cập nhật thông tin Hub",
      metadata: data,
    });
  }

  return updated;
};

export const deleteHub = async (id, actorUser = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("ID hub không hợp lệ", 400);
  }

  const hub = await hubRepo.findById(id);
  if (!hub) {
    throw new AppError("Hub không tồn tại", 404);
  }

  const droneCount = await Drone.countDocuments({ hubId: id });
  if (droneCount > 0) {
    throw new AppError(`Không thể xóa Hub đang quản lý ${droneCount} drone`, 400);
  }

  await hubRepo.deleteById(id);

  if (actorUser) {
    await recordAudit({
      actor: actorUser,
      action: "hub.delete",
      targetType: "hub",
      targetId: id,
      reason: "Xóa Hub",
      metadata: { code: hub.code, name: hub.name },
    });
  }

  return { success: true, message: "Hub đã được xóa" };
};

export const listHubs = async (filter = {}, pagination = {}) => {
  return await hubRepo.findAll(filter, pagination);
};

export const getHubById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("ID hub không hợp lệ", 400);
  }
  const hub = await hubRepo.findById(id);
  if (!hub) {
    throw new AppError("Hub không tồn tại", 404);
  }
  return hub;
};

export const getNearestHub = async (lat, lng) => {
  const hubs = await Hub.find({ status: "active" });
  if (!hubs.length) return null;

  const sorted = hubs
    .map((hub) => {
      const hubLat = hub.address?.lat ?? hub.location?.coordinates?.[1];
      const hubLng = hub.address?.lng ?? hub.location?.coordinates?.[0];
      if (hubLat == null || hubLng == null) return { hub, distanceKm: Infinity };
      const distanceKm = haversineKm({ lat: Number(lat), lng: Number(lng) }, { lat: hubLat, lng: hubLng });
      return { hub, distanceKm };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return sorted[0];
};
