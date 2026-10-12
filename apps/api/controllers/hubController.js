import * as hubService from "../services/hubService.js";

export const create = async (req, res) => {
  try {
    const hub = await hubService.createHub(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Tạo Hub mới thành công",
      data: hub,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const hub = await hubService.updateHub(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: "Cập nhật Hub thành công",
      data: hub,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const result = await hubService.deleteHub(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const list = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const pagination = {
      ...(page && { page: parseInt(page, 10) }),
      ...(limit && { limit: parseInt(limit, 10) }),
    };
    const result = await hubService.listHubs(filter, pagination);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const hub = await hubService.getHubById(req.params.id);
    res.json({
      success: true,
      data: hub,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
