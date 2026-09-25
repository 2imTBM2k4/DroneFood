import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./Orders.css";
import { assets } from "../../assets/assets";
import { formatVND } from "../../../../shared/utils/money";

const Orders = ({ url }) => {
  const [orders, setOrders] = useState([]);
  const [drones, setDrones] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  // "assign" = order still has no drone; "reassign" = swapping the drone on an
  // order already in flight, which is the exception handling a human is for.
  const [modalMode, setModalMode] = useState("assign");
  const [reassignReason, setReassignReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDrone, setSelectedDrone] = useState("");

  const fetchAllOrders = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login first");
      return;
    }
    const response = await axios.get(url + "/api/order/list", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.data.success) {
      setOrders(response.data.data);
    } else {
      toast.error("Error");
    }
  };

  const fetchDrones = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await axios.get(url + "/api/drone", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setDrones(response.data.data.filter(d => d.status === "available"));
      }
    } catch (error) {
      console.error("Error fetching drones:", error);
    }
  };

  const handleAssignDrone = async () => {
    if (!selectedDrone || !selectedOrder) {
      toast.error("Please select a drone");
      return;
    }
    if (modalMode === "reassign" && !reassignReason.trim()) {
      toast.error("A reason is required when changing the drone");
      return;
    }

    const token = localStorage.getItem("token");
    setSubmitting(true);
    try {
      const endpoint =
        modalMode === "reassign" ? "/api/drone/reassign" : "/api/drone/assign";

      const response = await axios.post(
        url + endpoint,
        {
          orderId: selectedOrder._id,
          droneId: selectedDrone,
          ...(modalMode === "reassign" && { reason: reassignReason.trim() }),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success(response.data.message || "Drone assigned successfully!");
        setShowAssignModal(false);
        setSelectedOrder(null);
        setSelectedDrone("");
        setReassignReason("");
        fetchAllOrders();
        fetchDrones();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error assigning drone");
    } finally {
      setSubmitting(false);
    }
  };

  const [acting, setActing] = useState(false);

  const handlePreflight = async (orderId, passed) => {
    const token = localStorage.getItem("token");
    if (!token) return toast.error("Vui lòng đăng nhập lại!");
    setActing(true);
    try {
      const res = await axios.post(
        url + "/api/drone/preflight",
        {
          orderId,
          passed,
          checklist: { rotors: "ok", battery: "ok", gps: "ok" },
          notes: passed ? "Preflight check passed" : "Preflight check failed",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        toast.success(res.data.message || "Preflight check thành công! Drone cất cánh.");
      } else {
        toast.warn(res.data.message || "Preflight check không đạt.");
      }
      fetchAllOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi kiểm tra preflight");
    } finally {
      setActing(false);
    }
  };

  const handleArrivedRestaurant = async (orderId) => {
    const token = localStorage.getItem("token");
    if (!token) return toast.error("Vui lòng đăng nhập lại!");
    setActing(true);
    try {
      const res = await axios.post(
        url + "/api/drone/arrived-restaurant",
        { orderId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message || "Drone đã đáp tại bãi đáp nhà hàng!");
      fetchAllOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi cập nhật trạng thái");
    } finally {
      setActing(false);
    }
  };

  const handleArrivedCustomer = async (orderId) => {
    const token = localStorage.getItem("token");
    if (!token) return toast.error("Vui lòng đăng nhập lại!");
    setActing(true);
    try {
      const res = await axios.post(
        url + "/api/drone/arrived-customer",
        { orderId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message || "Drone đã tới vị trí khách hàng!");
      fetchAllOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi cập nhật trạng thái");
    } finally {
      setActing(false);
    }
  };

  useEffect(() => {
    fetchAllOrders();
    fetchDrones();
  }, []);

  return (
    <div className="order add">
      <h3>Order History (All)</h3>
      <div className="order-list">
        {orders.map((order, index) => (
          <div key={index} className="order-item">
            <img src={assets.parcel_icon} alt="Order" />
            <div>
              <p className="order-item-food">
                {order.orderItems.map((item, idx) =>
                  idx === order.orderItems.length - 1
                    ? `${item.name} x ${item.quantity}`
                    : `${item.name} x ${item.quantity}, `
                )}
              </p>
              <p className="order-item-name">
                {order.shippingAddress.fullName}
              </p>
              {order.restaurantId && (
                <p className="order-item-restaurant">
                  Restaurant: {order.restaurantId.name}
                </p>
              )}
              <div className="order-item-address">
                <p>{order.shippingAddress.address},</p>
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state},{" "}
                  {order.shippingAddress.country},{" "}
                  {order.shippingAddress.zipCode}
                </p>
              </div>
              <p className="order-item-phone">{order.shippingAddress.phone}</p>
              
              {order.droneId && (
                <p className="order-item-drone">
                  🚁 Drone: {order.droneId.droneCode || order.droneId}
                </p>
              )}
              {order.qrCode && (
                <p className="order-item-qr">
                  📱 QR: {order.qrCode}
                </p>
              )}
            </div>
            <p>Items: {order.orderItems.length}</p>
            <p>{formatVND(order.totalPrice)}</p>
            <p>Status: {order.orderStatus}</p>
            {order.deliveryMethod === "drone" && (
              <div className="drone-telemetry-box">
                <p className="order-drone-phase">
                  Drone Phase: <span className={`drone-phase-badge phase-${order.dronePhase}`}>{order.dronePhase || "chưa xác định"}</span>
                </p>

                {/* Bộ nút điều khiển trạng thái Drone Telemetry */}
                <div className="drone-controls-group">
                  {order.dronePhase === "assigned" && (
                    <div className="drone-ctrl-btn-group">
                      <button
                        className="btn-telemetry btn-preflight-pass"
                        disabled={acting}
                        onClick={() => handlePreflight(order._id, true)}
                        title="Kiểm tra kỹ thuật đạt chuẩn và cho Drone cất cánh tới quán"
                      >
                        🛫 Cất cánh tới quán
                      </button>
                      <button
                        className="btn-telemetry btn-preflight-fail"
                        disabled={acting}
                        onClick={() => handlePreflight(order._id, false)}
                        title="Báo lỗi kỹ thuật - Đưa Drone về bảo trì"
                      >
                        ❌ Hỏng trước bay
                      </button>
                    </div>
                  )}

                  {order.dronePhase === "en_route_to_restaurant" && (
                    <button
                      className="btn-telemetry btn-arrive-restaurant"
                      disabled={acting}
                      onClick={() => handleArrivedRestaurant(order._id)}
                      title="Ghi nhận Drone đã tới bãi đáp của nhà hàng"
                    >
                      🛬 Báo đã đến quán
                    </button>
                  )}

                  {order.dronePhase === "awaiting_restaurant_handover" && (
                    <span className="telemetry-info-tag tag-handover">
                      ⏳ Chờ Nhà hàng bàn giao món...
                    </span>
                  )}

                  {order.dronePhase === "en_route_to_customer" && (
                    <button
                      className="btn-telemetry btn-arrive-customer"
                      disabled={acting}
                      onClick={() => handleArrivedCustomer(order._id)}
                      title="Ghi nhận Drone đã tới vị trí khách hàng"
                    >
                      🎯 Báo đã đến khách
                    </button>
                  )}

                  {order.dronePhase === "arrived_at_customer" && (
                    <span className="telemetry-info-tag tag-customer">
                      📱 Chờ khách quét QR lấy món
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {order.orderStatus === "preparing" && !order.droneId && (
              <button
                className="assign-drone-btn"
                onClick={() => {
                  setSelectedOrder(order);
                  setModalMode("assign");
                  setShowAssignModal(true);
                }}
              >
                🚁 Assign Drone
              </button>
            )}

            {/* Drone đang bay giữa hành trình bị cấm reassign theo quy định an toàn */}
            {order.droneId &&
              !["delivered", "cancelled"].includes(order.orderStatus) && (
                <div style={{ display: "inline-block" }}>
                  <button
                    className="assign-drone-btn assign-drone-btn--swap"
                    disabled={["en_route_to_restaurant", "en_route_to_customer"].includes(order.dronePhase)}
                    title={
                      ["en_route_to_restaurant", "en_route_to_customer"].includes(order.dronePhase)
                        ? "Không thể đổi drone khi đang bay giữa hành trình"
                        : "Đổi drone cho đơn hàng"
                    }
                    onClick={() => {
                      setSelectedOrder(order);
                      setModalMode("reassign");
                      setReassignReason("");
                      setShowAssignModal(true);
                    }}
                  >
                    🔄 Change Drone
                  </button>
                  {["en_route_to_restaurant", "en_route_to_customer"].includes(order.dronePhase) && (
                    <span style={{ fontSize: "11px", color: "#e65100", display: "block" }}>
                      (Đang bay: cấm đổi)
                    </span>
                  )}
                </div>
              )}
          </div>
        ))}
      </div>

      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modalMode === "reassign"
                  ? "Change the drone on this order"
                  : "Assign Drone to Order"}
              </h3>
              <button className="btn-close" onClick={() => setShowAssignModal(false)}>
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <p>Order ID: {selectedOrder?._id}</p>
              <p>Customer: {selectedOrder?.shippingAddress?.fullName}</p>
              {modalMode === "reassign" && (
                <p className="modal-note">
                  Drone cũ sẽ được chuyển sang chế độ bảo trì để kiểm tra kỹ thuật. Mã QR cũ sẽ bị vô hiệu hóa cho tới khi hoàn tất bàn giao món với drone mới.
                </p>
              )}
              
              <div className="form-group">
                <label>
                  {modalMode === "reassign"
                    ? "Replacement drone:"
                    : "Select Available Drone:"}
                </label>
                <select
                  value={selectedDrone}
                  onChange={(e) => setSelectedDrone(e.target.value)}
                >
                  <option value="">-- Select Drone --</option>
                  {drones.map((drone) => (
                    <option key={drone._id} value={drone._id}>
                      {drone.droneCode} (Battery: {drone.batteryLevel}%)
                    </option>
                  ))}
                </select>
              </div>

              {modalMode === "reassign" && (
                <div className="form-group">
                  <label>Reason (required)</label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    className="reassign-reason"
                    placeholder="e.g. Drone reported a sensor fault mid-flight"
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAssignModal(false)}>
                Cancel
              </button>
              <button
                className="btn-submit"
                onClick={handleAssignDrone}
                disabled={
                  submitting ||
                  !selectedDrone ||
                  (modalMode === "reassign" && !reassignReason.trim())
                }
              >
                {submitting
                  ? "Working…"
                  : modalMode === "reassign"
                  ? "Change drone"
                  : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
