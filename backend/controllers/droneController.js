import * as droneService from "../services/droneService.js";

export const getDeliveryAddresses = async (req, res) => {
  try {
    const result = await droneService.getDeliveryAddresses(
      req.user,
      req.params.orderId
    );
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const assignDrone = async (req, res) => {
  try {
    const result = await droneService.assignDroneToOrder(
      req.body.orderId,
      req.body.droneId
    );
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const scanQR = async (req, res) => {
  try {
    const result = await droneService.scanQRCode(
      req.user,
      req.body.orderId,
      req.body.qrCode
    );
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const confirmDelivery = async (req, res) => {
  try {
    const result = await droneService.confirmDelivery(req.user, req.body.orderId);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getAllDrones = async (req, res) => {
  try {
    const result = await droneService.getAllDrones();
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const createDrone = async (req, res) => {
  try {
    const result = await droneService.createDrone(req.body);
    res.status(201).json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateDrone = async (req, res) => {
  try {
    const result = await droneService.updateDrone(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const deleteDrone = async (req, res) => {
  try {
    const result = await droneService.deleteDrone(req.params.id);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getDroneById = async (req, res) => {
  try {
    const result = await droneService.getDroneById(req.params.id);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateCargoWeight = async (req, res) => {
  try {
    const result = await droneService.updateCargoWeight(
      req.body.droneId,
      req.body.weight
    );
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getDroneDeliveryHistory = async (req, res) => {
  try {
    const result = await droneService.getDroneDeliveryHistory(req.params.id);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getAllDeliveryHistory = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await droneService.getAllDeliveryHistory(page, limit);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const reassignDrone = async (req, res) => {
  try {
    const { orderId, droneId, reason } = req.body;
    const result = await droneService.reassignDrone(
      req.user,
      orderId,
      droneId,
      reason
    );
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const resetDrone = async (req, res) => {
  try {
    const result = await droneService.resetDrone(req.params.id);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const chargeDrone = async (req, res) => {
  try {
    const batteryLevel = req.body.batteryLevel !== undefined ? Number(req.body.batteryLevel) : 100;
    const result = await droneService.chargeDrone(req.params.id, batteryLevel);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const resetAllStuckDrones = async (req, res) => {
  try {
    const result = await droneService.resetAllStuckDrones();
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getFleetStats = async (req, res) => {
  try {
    const result = await droneService.getFleetOverview();
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const performPreflightCheck = async (req, res) => {
  try {
    const { orderId, passed, checklist, notes } = req.body;
    const result = await droneService.performPreflightCheck(req.user, {
      orderId,
      passed,
      checklist,
      notes,
    });
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const recordDroneArrivedRestaurant = async (req, res) => {
  try {
    const { orderId } = req.body;
    const result = await droneService.recordDroneArrivedRestaurant(orderId);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const confirmRestaurantHandover = async (req, res) => {
  try {
    const { orderId } = req.body;
    const result = await droneService.confirmRestaurantHandover(req.user, orderId);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const recordDroneArrivedCustomer = async (req, res) => {
  try {
    const { orderId } = req.body;
    const result = await droneService.recordDroneArrivedCustomer(orderId);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const handleCustomerFallbackConsent = async (req, res) => {
  try {
    const { orderId, consent } = req.body;
    const result = await droneService.handleCustomerFallbackConsent(req.user, {
      orderId,
      consent,
    });
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};


