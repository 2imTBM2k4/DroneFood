import * as orderService from "../services/orderService.js";
import { emitCustomerOrderUpdate } from "../utils/orderRealtime.js";

export const placeOrder = async (req, res) => {
  try {
    const result = await orderService.placeOrder(req.user, req.body, req.ip);

    const restaurantId = result.restaurantId;
    if (req.app.get("io") && restaurantId) {
      req.app
        .get("io")
        .to(`restaurant_${restaurantId}`)
        .emit("newOrder", result.orderId);
    }
    if (result.deliveryMethod === "shipper" && req.app.get("io")) {
      const { Order } = await import("../models/index.cjs");
      const { nearbyAvailableShipperIds } = await import("../services/shipperService.js");
      const order = await Order.findById(result.orderId).select("pickupLocation shipperAssignmentDeadlineAt");
      const shipperIds = await nearbyAvailableShipperIds(order?.pickupLocation);
      shipperIds.forEach((shipperId) => {
        req.app.get("io").to(`shipper_${shipperId}`).emit("shipperOrderOffer", {
          orderId: result.orderId,
          expiresAt: order.shipperAssignmentDeadlineAt,
        });
      });
    }

    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const quoteDelivery = async (req, res) => {
  try {
    const result = await orderService.quoteDelivery(req.user, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const verifyOrder = async (req, res) => {
  try {
    const result = await orderService.verifyOrder(req.user, req.body.orderId);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const vnpayReturn = async (req, res) => {
  try {
    const result = await orderService.handleVnpayReturn(req.query);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const redirect = new URL("/verify", frontendUrl);
    if (result.orderId) redirect.searchParams.set("orderId", result.orderId);
    redirect.searchParams.set("vnpay", result.paid ? "success" : "failed");
    res.redirect(302, redirect.toString());
  } catch {
    res.status(400).send("Invalid VNPay payment response.");
  }
};

export const userOrders = async (req, res) => {
  try {
    const result = await orderService.userOrders(req.user._id);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const listOrders = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pagination = page && limit ? { page: parseInt(page), limit: parseInt(limit) } : {};
    const result = await orderService.listOrders(req.user, pagination);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const result = await orderService.updateStatus(req.user, req.body);
    await emitCustomerOrderUpdate(req.app.get("io"), req.body.orderId);
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getStatusStats = async (req, res) => {
  try {
    const result = await orderService.getStatusStats();
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};
