import * as orderRepo from "../repositories/orderRepository.js";
import * as restaurantRepo from "../repositories/restaurantRepository.js";
import * as droneRepo from "../repositories/droneRepository.js";
import crypto from "crypto";
import Drone from "../models/droneModel.cjs";
import DroneDeliveryHistory from "../models/droneDeliveryHistoryModel.cjs";
import AppError from "../utils/AppError.js";
import { recordAudit } from "../utils/auditLog.js";
import { isZeroPayableVoucherOrder } from "../utils/zeroPayableVoucher.js";

/**
 * Lấy thông tin địa chỉ đầy đủ cho drone delivery
 */
export const getDeliveryAddresses = async (user, orderId) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  // This returns the customer's name, address and phone, so only the customer
  // themselves, the restaurant handling the order, or an admin may read it.
  if (user.role !== "admin") {
    const isCustomer = String(order.user?._id || order.user) === String(user._id);
    const orderRestId = String(
      order.restaurantId?._id || order.restaurantId || ""
    );
    const isTheRestaurant =
      user.role === "restaurant_owner" &&
      String(user.restaurantId || "") === orderRestId;

    if (!isCustomer && !isTheRestaurant) {
      throw new AppError("Unauthorized: Not your order", 403);
    }
  }

  let restaurant;
  if (order.restaurantId && typeof order.restaurantId === 'object' && order.restaurantId._id) {
    restaurant = order.restaurantId;
  } else {
    restaurant = await restaurantRepo.findById(order.restaurantId);
  }
  
  if (!restaurant) {
    throw new AppError("Restaurant not found", 404);
  }

  const customerAddress = order.shippingAddress;
  if (!customerAddress) {
    throw new AppError("Customer address not found", 404);
  }

  const customerFullAddress = [
    customerAddress.address,
    customerAddress.city,
    customerAddress.state,
    customerAddress.country,
    customerAddress.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    success: true,
    data: {
      restaurant: {
        name: restaurant.name,
        address: restaurant.address,
      },
      customer: {
        fullName: customerAddress.fullName,
        address: customerFullAddress,
        phone: customerAddress.phone,
        // Exact coordinates when the customer picked them on the map; the map
        // can use these directly instead of geocoding the address string.
        lat: customerAddress.lat ?? null,
        lng: customerAddress.lng ?? null,
      },
      orderId: order._id.toString(),
      orderStatus: order.orderStatus,
    },
  };
};

/**
 * Kiểm tra xem drone có thể bắt đầu giao hàng không
 */
export const canStartDelivery = async (orderId) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    return false;
  }
  return order.orderStatus === "delivering";
};

/**
 * Tạo QR code cho đơn hàng
 */
export const generateQRCode = (orderId) => {
  const hash = crypto.createHash("sha256");
  hash.update(`${orderId}-${Date.now()}-${process.env.JWT_SECRET || "secret"}`);
  return hash.digest("hex").substring(0, 16).toUpperCase();
};

/**
 * Gán drone cho đơn hàng (Admin thủ công hoặc test)
 * Drone được gán ở phase 'assigned', chưa sinh QR code cho tới khi nhà hàng bàn giao món.
 */
export const assignDroneToOrder = async (orderId, droneId) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  const cargoWeight = Math.floor(Math.random() * 1500) + 500;

  const drone = await Drone.findOneAndUpdate(
    // Same battery floor as the automatic dispatcher — picking the drone by
    // hand does not make a flat battery safe.
    {
      _id: droneId,
      status: "available",
      batteryLevel: { $gte: droneRepo.MIN_BATTERY_PERCENT },
    },
    {
      $set: {
        status: "delivering",
        currentOrder: orderId,
        cargoWeight,
      },
    },
    { new: true }
  );

  if (!drone) {
    throw new AppError(
      `Drone not found, already flying, or below ${droneRepo.MIN_BATTERY_PERCENT}% battery`,
      400
    );
  }

  order.droneId = droneId;
  order.dronePhase = "assigned";
  order.droneAssignedAt = new Date();
  order.droneArrivedAt = null;
  await order.save();

  return {
    success: true,
    message: "Drone assigned successfully.",
    data: {
      orderId: order._id,
      droneId: drone._id,
      droneCode: drone.droneCode,
      dronePhase: order.dronePhase,
      cargoWeight,
    },
  };
};

/**
 * Tự động tìm và điều phối drone khả dụng ngay khi đơn Drone thanh toán thành công
 * Nếu không còn drone đủ điều kiện, kích hoạt fallback_pending_customer_consent trong 10 phút.
 */
export const dispatchPaidDroneOrder = async (orderId) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.deliveryMethod !== "drone") {
    return { success: false, message: "Order is not drone delivery", ignored: true };
  }

  // Idempotent: nếu đã gán drone và không phải ở trạng thái lỗi cần re-dispatch
  if (order.droneId && !["preflight_failed", "recovery_required"].includes(order.dronePhase)) {
    return { success: true, message: "Drone already assigned", alreadyDispatched: true, droneId: order.droneId };
  }

  // Atomic claim một drone khả dụng có pin >= MIN_BATTERY_PERCENT, ít lượt bay nhất
  const drone = await Drone.findOneAndUpdate(
    {
      status: "available",
      batteryLevel: { $gte: droneRepo.MIN_BATTERY_PERCENT },
    },
    {
      $set: {
        status: "delivering",
        currentOrder: order._id,
        cargoWeight: 0,
        cargoLidStatus: "closed",
      },
    },
    { new: true, sort: { totalDeliveries: 1 } }
  );

  if (drone) {
    order.droneId = drone._id;
    order.dronePhase = "assigned";
    order.droneAssignedAt = new Date();
    order.qrCode = null; // QR chỉ được tạo khi nhà hàng bàn giao món
    order.dronePreflightStatus = "none";
    order.dronePreflightChecklist = null;
    await order.save();

    await recordAudit({
      actor: { role: "system", name: "DroneDispatcher" },
      action: "order.drone_dispatched",
      targetType: "order",
      targetId: order._id,
      metadata: {
        droneId: drone._id,
        droneCode: drone.droneCode,
        batteryLevel: drone.batteryLevel,
      },
    });

    return {
      success: true,
      droneDispatched: true,
      droneId: drone._id,
      droneCode: drone.droneCode,
      phase: "assigned",
    };
  }

  // Không có drone khả dụng: Chuyển sang fallback_pending_customer_consent trong 10 phút
  order.dronePhase = "fallback_pending_customer_consent";
  order.droneFallbackDeadlineAt = new Date(Date.now() + 10 * 60 * 1000);
  await order.save();

  await recordAudit({
    actor: { role: "system", name: "DroneDispatcher" },
    action: "order.drone_fallback_pending_consent",
    targetType: "order",
    targetId: order._id,
    metadata: {
      deadline: order.droneFallbackDeadlineAt,
    },
  });

  return {
    success: true,
    droneDispatched: false,
    fallbackPrompt: true,
    deadline: order.droneFallbackDeadlineAt,
  };
};

/**
 * Kiểm tra kỹ thuật trước cất cánh (Preflight check)
 */
export const performPreflightCheck = async (actor, { orderId, passed, checklist, notes }) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  if (!order.droneId) {
    throw new AppError("Đơn hàng chưa được gán drone", 400);
  }

  if (!["assigned", "preflight_check"].includes(order.dronePhase)) {
    throw new AppError(`Không thể preflight check ở pha [${order.dronePhase}]`, 400);
  }

  if (passed) {
    order.dronePreflightStatus = "passed";
    order.dronePreflightChecklist = checklist || {};
    order.dronePhase = "en_route_to_restaurant";
    await order.save();

    await recordAudit({
      actor,
      action: "order.drone_preflight_passed",
      targetType: "order",
      targetId: order._id,
      metadata: { droneId: order.droneId, checklist },
    });

    return {
      success: true,
      message: "Preflight check passed. Drone cất cánh tới nhà hàng.",
      phase: order.dronePhase,
    };
  }

  // Preflight failed: Đưa drone về maintenance, không cho phép bay
  order.dronePreflightStatus = "failed";
  order.dronePreflightChecklist = checklist || {};
  order.dronePhase = "preflight_failed";
  order.reason = notes || "Preflight check failed. Drone gặp lỗi kỹ thuật trước cất cánh.";
  await order.save();

  await Drone.findByIdAndUpdate(order.droneId, {
    status: "maintenance",
    currentOrder: null,
  });

  await recordAudit({
    actor,
    action: "order.drone_preflight_failed",
    targetType: "order",
    targetId: order._id,
    reason: order.reason,
    metadata: { droneId: order.droneId, checklist },
  });

  return {
    success: false,
    message: "Preflight check failed. Drone đã được đưa vào bảo trì.",
    phase: order.dronePhase,
  };
};

/**
 * Ghi nhận drone đã đến nhà hàng, sẵn sàng nhận bàn giao món
 */
export const recordDroneArrivedRestaurant = async (orderId) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  if (order.dronePhase !== "en_route_to_restaurant") {
    throw new AppError(`Drone chưa cất cánh tới nhà hàng hoặc không ở pha hợp lệ (Pha: ${order.dronePhase})`, 400);
  }

  order.dronePhase = "awaiting_restaurant_handover";
  await order.save();

  await recordAudit({
    actor: { role: "system", name: "DroneTelemetry" },
    action: "order.drone_arrived_restaurant",
    targetType: "order",
    targetId: order._id,
    metadata: { droneId: order.droneId },
  });

  return {
    success: true,
    message: "Drone đã tới điểm đáp nhà hàng, đang chờ bàn giao món.",
    phase: order.dronePhase,
  };
};

/**
 * Nhà hàng xác nhận đã xếp món vào thùng drone và đóng nắp an toàn
 * Trigger chuyển dronePhase -> en_route_to_customer, sinh mã QR bảo mật cho khách
 */
export const confirmRestaurantHandover = async (user, orderId) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  // Quyền: Restaurant Owner của chính quán đó hoặc Admin
  if (user.role !== "admin") {
    const orderRestId = String(order.restaurantId?._id || order.restaurantId || "");
    const userRestId = String(user.restaurantId || "");
    if (user.role !== "restaurant_owner" || userRestId !== orderRestId) {
      throw new AppError("Unauthorized: Not your restaurant", 403);
    }
  }

  if (order.dronePhase !== "awaiting_restaurant_handover") {
    throw new AppError(
      `Drone chưa sẵn sàng nhận bàn giao món tại nhà hàng (Pha hiện tại: ${order.dronePhase}). Vui lòng đợi drone hạ cánh.`,
      409
    );
  }

  const qrCode = generateQRCode(orderId);
  const cargoWeight = Math.floor(Math.random() * 1500) + 500;

  order.qrCode = qrCode;
  order.dronePhase = "en_route_to_customer";
  order.droneHandoverAt = new Date();
  order.orderStatus = "delivering";
  await order.save();

  const drone = await Drone.findByIdAndUpdate(
    order.droneId,
    { cargoWeight, cargoLidStatus: "closed" },
    { new: true }
  );

  const restaurant = await restaurantRepo.findById(order.restaurantId);
  const customerAddress = order.shippingAddress;

  await DroneDeliveryHistory.create({
    droneId: order.droneId,
    orderId: order._id,
    restaurantId: order.restaurantId,
    customerId: order.user,
    restaurantAddress: restaurant?.address || "N/A",
    customerAddress: `${customerAddress?.address || ""}, ${customerAddress?.city || ""}, ${customerAddress?.state || ""}`,
    customerName: customerAddress?.fullName || "N/A",
    customerPhone: customerAddress?.phone || "N/A",
    startTime: new Date(),
    status: "delivering",
    qrCode,
    cargoWeight,
    totalPrice: order.totalPrice,
  });

  await recordAudit({
    actor: user,
    action: "order.drone_handover_confirmed",
    targetType: "order",
    targetId: order._id,
    metadata: {
      droneId: order.droneId,
      droneCode: drone?.droneCode,
      cargoWeight,
      qrCode,
    },
  });

  return {
    success: true,
    message: "Nhà hàng bàn giao món thành công. Drone cất cánh bay tới khách hàng.",
    data: {
      orderId: order._id,
      dronePhase: order.dronePhase,
      orderStatus: order.orderStatus,
      qrCode,
    },
  };
};

/**
 * Ghi nhận drone đã đến vị trí khách hàng
 */
export const recordDroneArrivedCustomer = async (orderId) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  if (order.dronePhase !== "en_route_to_customer") {
    throw new AppError(`Drone chưa trên đường tới khách hàng (Pha hiện tại: ${order.dronePhase})`, 400);
  }

  order.dronePhase = "arrived_at_customer";
  order.orderStatus = "arrived_at_delivery";
  order.droneArrivedAt = new Date();
  await order.save();

  await recordAudit({
    actor: { role: "system", name: "DroneTelemetry" },
    action: "order.drone_arrived_customer",
    targetType: "order",
    targetId: order._id,
    metadata: { droneId: order.droneId },
  });

  return {
    success: true,
    message: "Drone đã tới điểm giao khách hàng an toàn.",
    phase: order.dronePhase,
  };
};

/**
 * Xử lý phản hồi của khách hàng khi không có Drone (Fallback sang Shipper hoặc Hủy đơn)
 * Khách đồng ý hay từ chối đều HỦY đơn Drone hiện tại và hoàn tiền tự động idempotent.
 */
export const handleCustomerFallbackConsent = async (user, { orderId, consent }) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (user.role !== "admin") {
    const isOwner = String(order.user?._id || order.user) === String(user._id);
    if (!isOwner) {
      throw new AppError("Unauthorized: Not your order", 403);
    }
  }

  if (order.dronePhase !== "fallback_pending_customer_consent") {
    throw new AppError("Đơn hàng không ở trạng thái chờ phản hồi chuyển đổi", 400);
  }

  const isExpired = order.droneFallbackDeadlineAt && new Date() > new Date(order.droneFallbackDeadlineAt);
  const accepted = consent === "accept_shipper" && !isExpired;
  const zeroPayableVoucherOrder = isZeroPayableVoucherOrder(order);

  order.orderStatus = "cancelled";
  order.dronePhase = "cancelled";
  order.reason = zeroPayableVoucherOrder
    ? accepted
      ? "Khách hàng đồng ý chuyển sang giao bằng Shipper; đơn Drone được thanh toán đủ bằng voucher đã hủy, không có khoản PayOS để hoàn."
      : isExpired
      ? "Hết thời gian 10 phút chờ khách hàng xác nhận; đơn Drone được thanh toán đủ bằng voucher đã hủy, không có khoản PayOS để hoàn."
      : "Khách hàng từ chối phương án chuyển sang giao bằng Shipper; đơn Drone được thanh toán đủ bằng voucher đã hủy, không có khoản PayOS để hoàn."
    : accepted
    ? "Khách hàng đồng ý chuyển sang giao bằng Shipper; đơn Drone cũ đã được hủy tự động để hoàn tiền và khách đặt lại đơn mới."
    : isExpired
    ? "Hết thời gian 10 phút chờ khách hàng xác nhận; đơn hàng đã tự động hủy."
    : "Khách hàng từ chối phương án chuyển sang giao bằng Shipper; đơn hàng đã bị hủy.";

  // Tự động hoàn tiền idempotent
  if (order.isPaid && !["requested", "paid"].includes(order.refundStatus)) {
    if (order.paymentMethod === "VNPAY") {
      try {
        const { requestVnpayRefund } = await import("./shipperService.js");
        const refundRequestId = await requestVnpayRefund(order);
        order.refundStatus = "requested";
        order.refundRequestId = refundRequestId;
        order.refundRequestedAt = new Date();
      } catch (refundErr) {
        order.refundStatus = "requested";
        order.refundRequestedAt = new Date();
      }
    } else if (order.paymentMethod === "PAYOS" && !zeroPayableVoucherOrder) {
      order.refundStatus = "requested";
      order.refundRequestedAt = new Date();
    }
  }

  try {
    const voucherRepo = await import("../repositories/voucherRepository.js");
    await voucherRepo.releaseForOrder(order._id, "drone_fallback_cancelled");
  } catch (vErr) {}

  await order.save();

  await recordAudit({
    actor: user,
    action: "order.drone_fallback_resolved",
    targetType: "order",
    targetId: order._id,
    reason: order.reason,
    metadata: {
      consent,
      isExpired,
      refundStatus: order.refundStatus,
    },
  });

  return {
    success: true,
    message: order.reason,
    data: {
      orderId: order._id,
      orderStatus: order.orderStatus,
      dronePhase: order.dronePhase,
      refundStatus: order.refundStatus,
      canOrderShipperNew: accepted,
    },
  };
};

/**
 * Xác nhận khách hàng đã quét QR (giả lập drone quét QR của khách)
 * Logic: Khách hàng nhấn nút "Xác nhận đã quét" → Nắp mở 5s
 */
export const scanQRCode = async (user, orderId, qrCode) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  if (order.user._id.toString() !== user._id.toString()) {
    throw new AppError("Unauthorized: Not your order", 403);
  }

  if (!order.qrCode) {
    throw new AppError("Order does not have QR code", 400);
  }

  if (order.qrCode !== qrCode) {
    throw new AppError("Invalid QR code", 400);
  }

  // Nếu đã quét trước đó, trả về thành công an toàn không ném lỗi 400
  if (order.qrScanned) {
    return {
      success: true,
      message: "QR code already scanned",
      data: {
        qrScanned: true,
        qrScannedAt: order.qrScannedAt,
        cargoChecked: order.cargoChecked,
      },
    };
  }

  // Đánh dấu đã quét QR (khách hàng đã xác nhận)
  order.qrScanned = true;
  order.qrScannedAt = new Date();
  await order.save();

  // Mở nắp khoang hàng của drone
  if (order.droneId) {
    const drone = await droneRepo.findById(order.droneId);
    if (drone) {
      drone.cargoLidStatus = "open";
      await drone.save();

      // Tự động đóng nắp sau 5 giây và hoàn tất đơn hàng
      setTimeout(async () => {
        await closeCargoLid(order.droneId, orderId);
      }, 5000);
    }
  }

  return {
    success: true,
    message: "Customer confirmed QR scan. Cargo lid is opening for 5 seconds...",
    data: {
      qrScanned: true,
      qrScannedAt: order.qrScannedAt,
    },
  };
};

/**
 * Đóng nắp khoang hàng & tự động hoàn tất giao đơn hàng
 */
export const closeCargoLid = async (droneId, orderId) => {
  const drone = await droneRepo.findById(droneId);
  if (!drone) {
    return;
  }

  const order = await orderRepo.findById(orderId);
  if (!order) {
    return;
  }

  // Đóng nắp
  drone.cargoLidStatus = "closed";
  
  // Giả lập: Khách hàng đã lấy hàng, trọng lượng giảm về 0
  drone.cargoWeight = 0;
  
  // Đánh dấu đã kiểm tra khoang hàng (trọng lượng = 0)
  order.cargoChecked = true;

  // Sau khi đóng nắp khoang hàng, chuyển trạng thái đơn sang đã giao thành công
  order.orderStatus = "delivered";
  order.dronePhase = "delivered";
  order.isDelivered = true;
  order.deliveredAt = new Date();
  order.isPaid = true;
  if (!order.paidAt) {
    order.paidAt = new Date();
  }

  drone.status = "available";
  drone.currentOrder = null;
  drone.cargoWeight = 0;
  drone.cargoLidStatus = "closed";
  drone.totalDeliveries = (drone.totalDeliveries || 0) + 1;
  drone.batteryLevel = Math.max(0, (drone.batteryLevel || 100) - Math.floor(Math.random() * 5 + 5));
  
  await drone.save();
  await order.save();

  // Cập nhật lịch sử giao hàng
  await DroneDeliveryHistory.findOneAndUpdate(
    { orderId: order._id, droneId: drone._id },
    { status: "delivered", endTime: new Date() }
  );

  return {
    success: true,
    message: "Cargo lid closed and delivery completed successfully",
  };
};

/**
 * Xác nhận đã nhận hàng (khách hàng nhấn nút)
 */
export const confirmDelivery = async (user, orderId) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  if (order.user._id.toString() !== user._id.toString()) {
    throw new AppError("Unauthorized: Not your order", 403);
  }

  if (order.orderStatus === "delivered") {
    return {
      success: true,
      message: "Delivery already confirmed",
      data: {
        orderId: order._id,
        deliveredAt: order.deliveredAt,
      },
    };
  }

  if (!order.qrScanned) {
    throw new AppError("QR code has not been scanned yet", 400);
  }

  order.cargoChecked = true;
  order.orderStatus = "delivered";
  order.dronePhase = "delivered";
  order.isDelivered = true;
  order.deliveredAt = new Date();
  order.isPaid = true;
  if (!order.paidAt) {
    order.paidAt = new Date();
  }
  await order.save();

  if (order.droneId) {
    const drone = await droneRepo.findById(order.droneId);
    if (drone) {
      drone.status = "available";
      drone.currentOrder = null;
      drone.cargoWeight = 0;
      drone.cargoLidStatus = "closed";
      drone.totalDeliveries = (drone.totalDeliveries || 0) + 1;
      drone.batteryLevel = Math.max(0, (drone.batteryLevel || 100) - Math.floor(Math.random() * 5 + 5));
      await drone.save();

      // Cập nhật lịch sử giao hàng
      await DroneDeliveryHistory.findOneAndUpdate(
        { orderId: order._id, droneId: drone._id },
        { status: "delivered", endTime: new Date() }
      );
    }
  }

  return {
    success: true,
    message: "Delivery confirmed successfully. Drone is now available for new orders.",
    data: {
      orderId: order._id,
      deliveredAt: order.deliveredAt,
    },
  };
};

/**
 * Lấy danh sách tất cả drone (Admin)
 */
export const getAllDrones = async () => {
  const drones = await droneRepo.findAll();
  return {
    success: true,
    data: drones,
  };
};

/**
 * Tạo drone mới (Admin)
 */
export const createDrone = async (droneData) => {
  const existingDrone = await droneRepo.findByCode(droneData.droneCode);
  if (existingDrone) {
    throw new AppError("Drone code already exists", 409);
  }

  const drone = await droneRepo.create(droneData);
  return {
    success: true,
    message: "Drone created successfully",
    data: drone,
  };
};

/**
 * Cập nhật drone (Admin)
 */
export const updateDrone = async (droneId, updateData) => {
  const drone = await droneRepo.findById(droneId);
  if (!drone) {
    throw new AppError("Drone not found", 404);
  }

  // Nếu thay đổi droneCode, kiểm tra trùng
  if (updateData.droneCode && updateData.droneCode !== drone.droneCode) {
    const existingDrone = await droneRepo.findByCode(updateData.droneCode);
    if (existingDrone) {
      throw new AppError("Drone code already exists", 409);
    }
  }

  if (updateData.status === "available") {
    if (updateData.currentOrder === undefined) updateData.currentOrder = null;
    if (updateData.cargoWeight === undefined) updateData.cargoWeight = 0;
    if (updateData.cargoLidStatus === undefined) updateData.cargoLidStatus = "closed";
  }

  const updatedDrone = await droneRepo.update(droneId, updateData);
  return {
    success: true,
    message: "Drone updated successfully",
    data: updatedDrone,
  };
};

/**
 * Xóa drone (Admin) - Chỉ xóa được nếu chưa giao đơn nào
 */
export const deleteDrone = async (droneId) => {
  const drone = await droneRepo.findById(droneId);
  if (!drone) {
    throw new AppError("Drone not found", 404);
  }

  if (drone.status === "delivering") {
    throw new AppError("Không thể xóa drone đang giao hàng", 400);
  }

  if (drone.totalDeliveries > 0) {
    throw new AppError(`Không thể xóa drone đã hoàn thành ${drone.totalDeliveries} đơn hàng. Drone này có lịch sử giao hàng.`, 409);
  }

  await droneRepo.deleteById(droneId);
  return {
    success: true,
    message: "Drone deleted successfully",
  };
};

/**
 * Lấy thông tin chi tiết drone
 */
export const getDroneById = async (droneId) => {
  const drone = await droneRepo.findById(droneId);
  if (!drone) {
    throw new AppError("Drone not found", 404);
  }

  return {
    success: true,
    data: drone,
  };
};

/**
 * [DEPRECATED] Kiểm tra timeout giao hàng (20 giây)
 * NOTE: Hàm này không còn được sử dụng vì timeout được xử lý ở frontend
 * Frontend sẽ gọi API /api/order/status để cập nhật trạng thái khi timeout
 * 
 * Lý do: setTimeout() ở server không đáng tin cậy (server restart sẽ mất timeout)
 */
export const checkDeliveryTimeout = async (orderId) => {
  const order = await orderRepo.findById(orderId);
  if (!order) {
    return;
  }

  // Nếu đã quét QR rồi thì không làm gì
  if (order.qrScanned) {
    return;
  }

  // Nếu chưa quét QR sau 20s → Giao thất bại
  order.orderStatus = "cancelled";
  order.reason = "⏳ Hết thời gian chờ nhận hàng - Drone đã đợi tại điểm giao nhưng không nhận được tín hiệu xác nhận an toàn từ bạn trong thời gian quy định. Đơn hàng đã bị hủy.";
  order.isDelivered = false;
  await order.save();

  // Drone bay về nhà hàng
  if (order.droneId) {
    const drone = await droneRepo.findById(order.droneId);
    if (drone) {
      drone.status = "available";
      drone.currentOrder = null;
      drone.cargoWeight = 0;
      drone.cargoLidStatus = "closed";
      await drone.save();
    }
  }

  console.log(`Order ${orderId} failed: Customer did not receive delivery within 20 seconds`);
};

/**
 * Lấy lịch sử giao hàng của drone (Admin)
 */
export const getDroneDeliveryHistory = async (droneId) => {
  const drone = await droneRepo.findById(droneId);
  if (!drone) {
    throw new AppError("Drone not found", 404);
  }

  let history = await DroneDeliveryHistory.find({ droneId })
    .populate("orderId", "orderStatus totalPrice createdAt")
    .populate("restaurantId", "name")
    .populate("customerId", "name email")
    .sort({ createdAt: -1 });

  if (!history || history.length === 0) {
    const Order = (await import("../models/orderModel.cjs")).default;
    const orders = await Order.find({ droneId })
      .populate("restaurantId", "name address")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    history = orders.map((o) => ({
      _id: o._id,
      orderId: {
        _id: o._id,
        orderStatus: o.orderStatus,
        totalPrice: o.totalPrice,
        createdAt: o.createdAt,
      },
      restaurantId: o.restaurantId ? { name: o.restaurantId.name } : { name: "N/A" },
      customerId: o.user ? { name: o.user.name, email: o.user.email } : null,
      customerName: o.shippingAddress?.fullName || o.user?.name || "Khách hàng",
      customerAddress: typeof o.shippingAddress === "object"
        ? `${o.shippingAddress.address || ""}, ${o.shippingAddress.city || ""}`.trim()
        : String(o.shippingAddress || "Hồ Chí Minh"),
      totalPrice: o.totalPrice,
      startTime: o.createdAt,
      endTime: o.deliveredAt,
      status: o.orderStatus,
    }));
  }

  return {
    success: true,
    data: {
      drone: {
        _id: drone._id,
        droneCode: drone.droneCode,
        totalDeliveries: drone.totalDeliveries,
        status: drone.status,
      },
      history,
    },
  };
};

/**
 * Lấy tất cả lịch sử giao hàng (Admin)
 */
export const getAllDeliveryHistory = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  
  const [history, total] = await Promise.all([
    DroneDeliveryHistory.find()
      .populate("droneId", "droneCode")
      .populate("orderId", "orderStatus totalPrice")
      .populate("restaurantId", "name")
      .populate("customerId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    DroneDeliveryHistory.countDocuments(),
  ]);

  return {
    success: true,
    data: history,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Cập nhật trọng lượng khoang hàng (giả lập cảm biến)
 */
export const updateCargoWeight = async (droneId, weight) => {
  const drone = await droneRepo.findById(droneId);
  if (!drone) {
    throw new AppError("Drone not found", 404);
  }

  drone.cargoWeight = weight;
  await drone.save();

  // Nếu trọng lượng = 0 và nắp đang đóng, đánh dấu đã kiểm tra khoang hàng
  if (weight === 0 && drone.cargoLidStatus === "closed" && drone.currentOrder) {
    const order = await orderRepo.findById(drone.currentOrder);
    if (order) {
      order.cargoChecked = true;
      await order.save();
    }
  }

  return {
    success: true,
    message: "Cargo weight updated",
    data: {
      droneId: drone._id,
      cargoWeight: drone.cargoWeight,
    },
  };
};

/**
 * Swap the drone on an in-flight order — the human-in-the-loop action a real
 * operator needs when the assigned aircraft fails, runs low or is grounded.
 *
 * The old drone is released back to the fleet and the new one takes over. The
 * order keeps its QR code: the customer may already have it on screen, and the
 * code identifies the order, not the aircraft.
 */
export const reassignDrone = async (actor, orderId, newDroneId, reason) => {
  if (!reason || !reason.trim()) {
    throw new AppError("A reason is required when changing an order's drone", 400);
  }

  const order = await orderRepo.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  if (!order.droneId) {
    throw new AppError("This order has no drone assigned yet", 400);
  }
  if (["delivered", "cancelled"].includes(order.orderStatus)) {
    throw new AppError("This order is already finished", 400);
  }

  // Chặn đổi drone khi đang bay giữa hành trình
  if (["en_route_to_restaurant", "en_route_to_customer"].includes(order.dronePhase)) {
    throw new AppError("Không thể đổi drone khi đang bay giữa hành trình", 409);
  }

  const previousDroneId = String(order.droneId._id || order.droneId);
  if (previousDroneId === String(newDroneId)) {
    throw new AppError("That drone is already on this order", 400);
  }

  // Claim the replacement first: if nothing suitable is free we must not have
  // released the current drone and left the order with none at all.
  const cargoWeight = order.orderItems?.length
    ? Math.floor(Math.random() * 1500) + 500
    : 0;

  const newDrone = await Drone.findOneAndUpdate(
    {
      _id: newDroneId,
      status: "available",
      batteryLevel: { $gte: droneRepo.MIN_BATTERY_PERCENT },
    },
    {
      $set: {
        status: "delivering",
        currentOrder: orderId,
        cargoWeight,
        cargoLidStatus: "closed",
      },
    },
    { new: true }
  );

  if (!newDrone) {
    throw new AppError(
      `Replacement drone not found, already flying, or below ${droneRepo.MIN_BATTERY_PERCENT}% battery`,
      400
    );
  }

  // Drone cũ gặp lỗi hoặc cần thay thế: Chuyển sang MAINTENANCE, KHÔNG đưa về AVAILABLE
  const previousDrone = await Drone.findById(previousDroneId);
  await Drone.findByIdAndUpdate(previousDroneId, {
    $set: {
      status: "maintenance",
      currentOrder: null,
      cargoWeight: 0,
      cargoLidStatus: "closed",
    },
  });

  // Vô hiệu hóa mã QR cũ và reset về phase 'assigned' để thực hiện preflight check lại cho drone mới
  order.droneId = newDrone._id;
  order.qrCode = null;
  order.dronePhase = "assigned";
  order.dronePreflightStatus = "none";
  order.dronePreflightChecklist = null;
  await order.save();

  await recordAudit({
    actor,
    action: "order.drone_reassigned",
    targetType: "order",
    targetId: orderId,
    reason: reason.trim(),
    metadata: {
      fromDrone: previousDrone?.droneCode || previousDroneId,
      toDrone: newDrone.droneCode,
      fromPhase: order.dronePhase,
    },
  });

  return {
    success: true,
    message: `Order moved to drone ${newDrone.droneCode}`,
    data: {
      orderId: order._id,
      droneId: newDrone._id,
      droneCode: newDrone.droneCode,
      dronePhase: order.dronePhase,
    },
  };
};

/**
 * Thu hồi / Đặt lại drone về trạng thái sẵn sàng (Admin)
 */
export const resetDrone = async (droneId) => {
  const drone = await droneRepo.findById(droneId);
  if (!drone) {
    throw new AppError("Drone not found", 404);
  }
  const updated = await droneRepo.resetDrone(droneId);
  return {
    success: true,
    message: `Drone ${drone.droneCode} đã được đặt lại về trạng thái sẵn sàng.`,
    data: updated,
  };
};

/**
 * Sạc pin cho drone (Admin)
 */
export const chargeDrone = async (droneId, batteryLevel = 100) => {
  const drone = await droneRepo.findById(droneId);
  if (!drone) {
    throw new AppError("Drone not found", 404);
  }
  const updated = await droneRepo.chargeDrone(droneId, batteryLevel);
  return {
    success: true,
    message: `Drone ${drone.droneCode} đã được sạc pin lên ${batteryLevel}%.`,
    data: updated,
  };
};

/**
 * Đặt lại tất cả drone đang bị kẹt về sẵn sàng (Admin)
 */
export const resetAllStuckDrones = async () => {
  const result = await droneRepo.resetAllStuckDrones();
  return {
    success: true,
    message: `Đã giải phóng và đặt lại ${result.modifiedCount || 0} drone về trạng thái sẵn sàng.`,
    data: result,
  };
};

/**
 * Lấy thống kê tổng quan hạm đội drone (Admin)
 */
export const getFleetOverview = async () => {
  const stats = await droneRepo.getFleetStats();
  return {
    success: true,
    data: stats,
  };
};
