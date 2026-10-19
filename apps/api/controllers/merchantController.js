import * as merchantService from "../services/merchantService.js";

export const register = async (req, res) => {
  try {
    const result = await merchantService.registerMerchant({
      userId: req.user._id,
      name: req.body.name,
      address: req.body.address,
      phone: req.body.phone,
      images: req.body.images,
    });
    res.status(201).json({
      success: true,
      message: "Đăng ký merchant thành công",
      data: result,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const result = await merchantService.getMyMerchantProfile(req.user);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const merchantId = req.params.id || req.params.merchantId;
    const updated = await merchantService.updateMerchant(
      merchantId,
      req.body,
      req.user
    );
    res.json({
      success: true,
      message: "Cập nhật merchant thành công",
      data: updated,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const list = async (req, res) => {
  try {
    const { status, type, q, page, limit, sortBy, order } = req.query;
    const result = await merchantService.listMerchants({
      status,
      type,
      q,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
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

export const approve = async (req, res) => {
  try {
    const merchantId = req.params.id || req.params.merchantId;
    const approved = await merchantService.approveMerchant(
      merchantId,
      req.user._id
    );
    res.json({
      success: true,
      message: "Phê duyệt merchant thành công",
      data: approved,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const suspend = async (req, res) => {
  try {
    const merchantId = req.params.id || req.params.merchantId;
    const suspended = await merchantService.suspendMerchant(
      merchantId,
      req.user._id,
      req.body.reason
    );
    res.json({
      success: true,
      message: "Đình chỉ merchant thành công",
      data: suspended,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getPublic = async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await merchantService.getPublicMerchantBySlug(slug);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const submitBrandApplication = async (req, res) => {
  try {
    const result = await merchantService.submitBrandApplication({
      userId: req.user._id,
      merchantId: req.body.merchantId,
      applicationData: req.body,
    });
    res.status(201).json({
      success: true,
      message: "Nộp hồ sơ nâng cấp chuỗi thương hiệu thành công",
      data: result,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getBrandApplication = async (req, res) => {
  try {
    const result = await merchantService.getBrandApplication({
      userId: req.user._id,
      merchantId: req.query.merchantId,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const listBrandApplications = async (req, res) => {
  try {
    const { status, page, limit, q } = req.query;
    const result = await merchantService.listBrandApplications({
      status,
      page,
      limit,
      q,
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

export const decideBrandApplication = async (req, res) => {
  try {
    const merchantId = req.params.id || req.params.merchantId;
    const result = await merchantService.decideBrandApplication(
      merchantId,
      req.body,
      req.user
    );
    res.json({
      success: true,
      message:
        req.body.decision === "approved"
          ? "Phê duyệt hồ sơ chuỗi thương hiệu thành công"
          : "Đã từ chối hồ sơ chuỗi thương hiệu",
      data: result,
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};
