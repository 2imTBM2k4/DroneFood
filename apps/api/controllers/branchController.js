import * as branchService from "../services/branchService.js";
import * as branchRepo from "../repositories/branchRepository.js";
import * as applicationService from "../services/droneDeliveryApplicationService.js";

export const managed = async (req, res, next) => {
  try {
    res.json({ success: true, code: "MANAGED_BRANCHES", data: await applicationService.listManagedBranches(req.user) });
  } catch (error) { next(error); }
};

export const adminList = async (req, res, next) => {
  try {
    const { applicationStatus, merchantId, status, droneDeliveryEnabled, q, ...options } = req.query;
    const filter = {
      ...(merchantId && { merchantId }), ...(status && { status }),
      ...(droneDeliveryEnabled !== undefined && { droneDeliveryEnabled }),
      ...(applicationStatus && (applicationStatus === "not_registered"
        ? { $or: [{ "droneDeliveryApplication.status": "not_registered" }, { "droneDeliveryApplication.status": { $exists: false } }] }
        : { "droneDeliveryApplication.status": applicationStatus })),
    };
    const result = await branchRepo.findAll(filter, { ...options, q: q ? q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "", includeApplication: true });
    res.json({ success: true, code: "ADMIN_BRANCHES", ...result });
  } catch (error) { next(error); }
};

export const getApplication = async (req, res, next) => {
  try {
    res.json({ success: true, code: "DRONE_APPLICATION", data: await applicationService.getApplication(req.params.id) });
  } catch (error) { next(error); }
};

export const submitApplication = async (req, res, next) => {
  try {
    const data = await applicationService.submitApplication(req.params.id, req.body, req.user);
    res.status(201).json({ success: true, code: "DRONE_APPLICATION_SUBMITTED", message: "Đã gửi hồ sơ, vui lòng chờ xét duyệt", data });
  } catch (error) { next(error); }
};

export const decideApplication = async (req, res, next) => {
  try {
    const data = await applicationService.decideApplication(req.params.id, req.body, req.user);
    res.json({ success: true, code: "DRONE_APPLICATION_REVIEWED", message: "Đã lưu kết quả xét duyệt", data });
  } catch (error) { next(error); }
};

export const nearby = async (req, res) => {
  try {
    const { lat, lng, radius, limit } = req.query;
    const results = await branchService.resolveNearestBranches({
      lat,
      lng,
      radiusKm: radius,
      limit,
    });
    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const listByMerchant = async (req, res) => {
  try {
    const {
      merchantId,
      status,
      droneDeliveryEnabled,
      q,
      page,
      limit,
      sortBy,
      order,
    } = req.query;
    const result = await branchService.listBranches({
      merchantId,
      status,
      droneDeliveryEnabled,
      q,
      ...(page && { page: parseInt(page, 10) }),
      ...(limit && { limit: parseInt(limit, 10) }),
      sortBy,
      order,
    });
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const branch = await branchRepo.findById(req.params.id);
    if (!branch) {
      return res
        .status(404)
        .json({ success: false, message: "Chi nhánh không tồn tại" });
    }
    res.json({
      success: true,
      data: branch,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const merchantId = req.body.merchantId;
    const branch = await branchService.createBranch(
      merchantId,
      req.body,
      req.user
    );
    res.status(201).json({
      success: true,
      message: "Tạo chi nhánh mới thành công",
      data: branch,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const branch = await branchService.updateBranch(
      req.params.id,
      req.body,
      req.user
    );
    res.json({
      success: true,
      message: "Cập nhật chi nhánh thành công",
      data: branch,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const setOpenState = async (req, res) => {
  try {
    const branch = await branchService.setBranchOpenState(
      req.params.id,
      req.body.isOpen,
      req.user
    );
    res.json({
      success: true,
      message: req.body.isOpen
        ? "Mở cửa chi nhánh thành công"
        : "Đóng cửa chi nhánh thành công",
      data: branch,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const result = await branchService.deleteBranch(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const lock = async (req, res) => {
  try {
    const branch = await branchService.lockBranch(
      req.params.id,
      req.body.isLocked,
      req.user,
      req.body.reason
    );
    res.json({
      success: true,
      message: req.body.isLocked
        ? "Khóa chi nhánh thành công"
        : "Mở khóa chi nhánh thành công",
      data: branch,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const assignManagers = async (req, res) => {
  try {
    const branch = await branchService.assignBranchManagers(
      req.params.id,
      req.body.userIds,
      req.user
    );
    res.json({
      success: true,
      message: "Gán quản lý chi nhánh thành công",
      data: branch,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const setDroneDelivery = async (req, res) => {
  try {
    const branch = await branchService.setDroneDelivery(
      req.params.id,
      req.body.enabled,
      req.user
    );
    res.json({
      success: true,
      message: req.body.enabled
        ? "Bật giao hàng bằng drone thành công"
        : "Tắt giao hàng bằng drone thành công",
      data: branch,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};
