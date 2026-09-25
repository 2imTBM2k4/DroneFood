import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./Drones.css";

const Drones = ({ url }) => {
  const [drones, setDrones] = useState([]);
  const [fleetStats, setFleetStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedDroneHistory, setSelectedDroneHistory] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingDrone, setEditingDrone] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [formData, setFormData] = useState({
    droneCode: "",
    cargoWeight: 0,
    status: "available",
    cargoLidStatus: "closed",
    batteryLevel: 100,
  });

  useEffect(() => {
    fetchDrones();
    fetchFleetStats();

    // Auto-refresh mỗi 5 giây để cập nhật trạng thái drone
    const interval = setInterval(() => {
      fetchDrones();
      fetchFleetStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchDrones = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${url}/api/drone`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setDrones(response.data.data);
      }
    } catch (error) {
      console.error("Lỗi khi tải danh sách drone:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFleetStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${url}/api/drone/stats/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setFleetStats(response.data.data);
      }
    } catch (error) {
      console.error("Lỗi khi tải thống kê hạm đội:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "cargoWeight" || name === "batteryLevel" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");

      if (editingDrone) {
        // Update
        const response = await axios.put(
          `${url}/api/drone/${editingDrone._id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.success) {
          toast.success("Cập nhật drone thành công");
          fetchDrones();
          fetchFleetStats();
        }
      } else {
        // Create
        const response = await axios.post(
          `${url}/api/drone/create`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.success) {
          toast.success("Tạo drone mới thành công");
          fetchDrones();
          fetchFleetStats();
        }
      }

      handleCloseModal();
    } catch (error) {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra");
      console.error(error);
    }
  };

  const handleEdit = (drone) => {
    setEditingDrone(drone);
    setFormData({
      droneCode: drone.droneCode,
      cargoWeight: drone.cargoWeight || 0,
      status: drone.status || "available",
      cargoLidStatus: drone.cargoLidStatus || "closed",
      batteryLevel: drone.batteryLevel ?? 100,
    });
    setShowModal(true);
  };

  const handleResetDrone = async (droneId, droneCode) => {
    if (!window.confirm(`Bạn có chắc muốn đặt lại ${droneCode} về trạng thái Sẵn sàng? Thao tác này sẽ xóa đơn kẹt và đặt trọng lượng về 0.`)) {
      return;
    }

    try {
      setActionLoading((prev) => ({ ...prev, [droneId]: "reset" }));
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${url}/api/drone/${droneId}/reset`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success(response.data.message || `Đã đặt lại ${droneCode} về sẵn sàng`);
        fetchDrones();
        fetchFleetStats();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể đặt lại drone");
      console.error(error);
    } finally {
      setActionLoading((prev) => ({ ...prev, [droneId]: null }));
    }
  };

  const handleChargeDrone = async (droneId, droneCode) => {
    try {
      setActionLoading((prev) => ({ ...prev, [droneId]: "charge" }));
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${url}/api/drone/${droneId}/charge`,
        { batteryLevel: 100 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success(`Đã sạc đầy 100% pin cho ${droneCode}`);
        fetchDrones();
        fetchFleetStats();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể sạc pin");
      console.error(error);
    } finally {
      setActionLoading((prev) => ({ ...prev, [droneId]: null }));
    }
  };

  const handleResetAllStuck = async () => {
    if (!window.confirm("Bạn có chắc muốn đặt lại TẤT CẢ drone đang bận / kẹt về trạng thái Sẵn sàng?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${url}/api/drone/reset-all-stuck`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success(response.data.message || "Đã giải phóng toàn bộ drone kẹt");
        fetchDrones();
        fetchFleetStats();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể đặt lại drone");
      console.error(error);
    }
  };

  const handleDelete = async (droneId) => {
    if (!window.confirm("Bạn có chắc muốn xóa drone này?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(`${url}/api/drone/${droneId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        toast.success("Xóa drone thành công");
        fetchDrones();
        fetchFleetStats();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể xóa drone");
      console.error(error);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDrone(null);
    setFormData({
      droneCode: "",
      cargoWeight: 0,
      status: "available",
      cargoLidStatus: "closed",
      batteryLevel: 100,
    });
  };

  const handleViewHistory = async (drone) => {
    setSelectedDroneHistory(drone);
    setShowHistoryModal(true);
    setHistoryLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${url}/api/drone/history/${drone._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setHistoryData(response.data.data.history);
      }
    } catch (error) {
      toast.error("Lỗi khi tải lịch sử giao hàng");
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCloseHistoryModal = () => {
    setShowHistoryModal(false);
    setSelectedDroneHistory(null);
    setHistoryData([]);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("vi-VN");
  };

  const getHistoryStatusBadge = (status) => {
    const statusMap = {
      delivering: { text: "Đang giao", class: "history-delivering" },
      delivered: { text: "Thành công", class: "history-delivered" },
      cancelled: { text: "Đã hủy", class: "history-cancelled" },
    };
    const statusInfo = statusMap[status] || { text: status, class: "" };
    return <span className={`history-status ${statusInfo.class}`}>{statusInfo.text}</span>;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      available: { text: "Sẵn sàng", class: "status-available" },
      delivering: { text: "Đang giao", class: "status-delivering" },
      delivered: { text: "Đã giao", class: "status-delivered" },
      maintenance: { text: "Bảo trì", class: "status-maintenance" },
      offline: { text: "Ngoại tuyến", class: "status-offline" },
    };
    const statusInfo = statusMap[status] || { text: status, class: "" };
    return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.text}</span>;
  };

  const getLidStatusBadge = (lidStatus) => {
    return (
      <span className={`lid-badge ${lidStatus === "open" ? "lid-open" : "lid-closed"}`}>
        {lidStatus === "open" ? "Đang mở" : "Đang đóng"}
      </span>
    );
  };

  const getBatteryClass = (level) => {
    if (level >= 70) return "battery-high";
    if (level >= 30) return "battery-medium";
    return "battery-low";
  };

  if (loading) {
    return <div className="loading">Đang tải thông tin hạm đội drone...</div>;
  }

  // Thống kê hiển thị (từ API hoặc fallback tính từ mảng drones)
  const totalCount = fleetStats?.total ?? drones.length;
  const availableCount = fleetStats?.available ?? drones.filter((d) => d.status === "available").length;
  const deliveringCount = fleetStats?.delivering ?? drones.filter((d) => d.status === "delivering").length;
  const maintenanceCount = fleetStats ? fleetStats.maintenance + fleetStats.offline : drones.filter((d) => ["maintenance", "offline"].includes(d.status)).length;
  const avgBattery = fleetStats?.avgBattery ?? (totalCount > 0 ? Math.round(drones.reduce((acc, d) => acc + (d.batteryLevel || 0), 0) / totalCount) : 100);
  const lowBatteryCount = fleetStats?.lowBattery ?? drones.filter((d) => (d.batteryLevel || 0) < 30).length;

  return (
    <div className="drones-container">
      {/* HEADER */}
      <div className="drones-header">
        <div className="header-left">
          <h1>Quản lý Hạm đội Drone</h1>
          <span className="auto-refresh-indicator">🔄 Tự động cập nhật mỗi 5s</span>
        </div>
        <div className="header-actions">
          {deliveringCount > 0 && (
            <button
              className="btn-reset-all"
              onClick={handleResetAllStuck}
              title="Đặt lại toàn bộ drone đang bận về sẵn sàng"
            >
              ⚡ Đặt lại tất cả drone kẹt ({deliveringCount})
            </button>
          )}
          <button className="btn-add" onClick={() => setShowModal(true)}>
            + Thêm Drone
          </button>
        </div>
      </div>

      {/* FLEET METRICS OVERVIEW */}
      <div className="fleet-metrics-grid">
        <div className="metric-card metric-total">
          <div className="metric-icon">🛸</div>
          <div className="metric-data">
            <span className="metric-value">{totalCount}</span>
            <span className="metric-label">Tổng số Drone</span>
          </div>
        </div>
        <div className="metric-card metric-available">
          <div className="metric-icon">🟢</div>
          <div className="metric-data">
            <span className="metric-value">{availableCount}</span>
            <span className="metric-label">Sẵn sàng nhận đơn</span>
          </div>
        </div>
        <div className="metric-card metric-delivering">
          <div className="metric-icon">🟣</div>
          <div className="metric-data">
            <span className="metric-value">{deliveringCount}</span>
            <span className="metric-label">Đang bay giao hàng</span>
          </div>
        </div>
        <div className="metric-card metric-maintenance">
          <div className="metric-icon">🟡</div>
          <div className="metric-data">
            <span className="metric-value">{maintenanceCount}</span>
            <span className="metric-label">Bảo trì / Ngoại tuyến</span>
          </div>
        </div>
        <div className={`metric-card metric-battery ${lowBatteryCount > 0 ? "warning" : ""}`}>
          <div className="metric-icon">⚡</div>
          <div className="metric-data">
            <span className="metric-value">{avgBattery}%</span>
            <span className="metric-label">
              Pin TB {lowBatteryCount > 0 && `(${lowBatteryCount} drone < 30%)`}
            </span>
          </div>
        </div>
      </div>

      {/* DRONES GRID */}
      <div className="drones-grid">
        {drones.map((drone) => (
          <div key={drone._id} className={`drone-card ${drone.status}`}>
            <div className="drone-card-header">
              <div className="drone-header-code">
                <h3>{drone.droneCode}</h3>
                <span className={`battery-pill ${getBatteryClass(drone.batteryLevel)}`}>
                  ⚡ {drone.batteryLevel}%
                </span>
              </div>
              {getStatusBadge(drone.status)}
            </div>

            <div className="drone-info">
              <div className="info-row">
                <span className="label">Trọng lượng khoang:</span>
                <span className={`value weight-value ${drone.cargoWeight > 0 ? "loaded" : "empty"}`}>
                  {drone.cargoWeight}g
                </span>
              </div>
              <div className="info-row">
                <span className="label">Nắp khoang:</span>
                {getLidStatusBadge(drone.cargoLidStatus)}
              </div>
              <div className="info-row">
                <span className="label">Mức pin:</span>
                <div className="battery-bar-container">
                  <div
                    className={`battery-bar-fill ${getBatteryClass(drone.batteryLevel)}`}
                    style={{ width: `${Math.min(100, Math.max(0, drone.batteryLevel))}%` }}
                  />
                </div>
              </div>
              <div className="info-row">
                <span className="label">Tổng giao hàng:</span>
                <span className="value">{drone.totalDeliveries} đơn</span>
              </div>
              {drone.currentOrder && (
                <div className="info-row current-order-row">
                  <span className="label">Đơn hiện tại:</span>
                  <span className="value order-id">
                    #{typeof drone.currentOrder === "object" ? drone.currentOrder._id?.slice(-6) : String(drone.currentOrder).slice(-6)}
                  </span>
                </div>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="drone-actions">
              <button
                className="btn-history"
                onClick={() => handleViewHistory(drone)}
                title="Xem lịch sử giao hàng"
              >
                📋 Lịch sử
              </button>

              <button
                className="btn-reset"
                onClick={() => handleResetDrone(drone._id, drone.droneCode)}
                disabled={actionLoading[drone._id] === "reset"}
                title="Đặt lại về trạng thái sẵn sàng (xóa kẹt)"
              >
                {actionLoading[drone._id] === "reset" ? "..." : "🔄 Đặt lại"}
              </button>

              {drone.batteryLevel < 100 && (
                <button
                  className="btn-charge"
                  onClick={() => handleChargeDrone(drone._id, drone.droneCode)}
                  disabled={actionLoading[drone._id] === "charge"}
                  title="Sạc nhanh đầy 100% pin"
                >
                  {actionLoading[drone._id] === "charge" ? "..." : "⚡ Sạc"}
                </button>
              )}

              <button className="btn-edit" onClick={() => handleEdit(drone)}>
                Sửa
              </button>

              <button
                className="btn-delete"
                onClick={() => handleDelete(drone._id)}
                disabled={drone.status === "delivering" || drone.totalDeliveries > 0}
                title={drone.totalDeliveries > 0 ? "Không thể xóa drone đã giao hàng" : ""}
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {drones.length === 0 && (
        <div className="empty-state">
          <p>Chưa có drone nào. Hãy thêm drone mới!</p>
        </div>
      )}

      {/* MODAL LỊCH SỬ GIAO HÀNG */}
      {showHistoryModal && selectedDroneHistory && (
        <div className="modal-overlay" onClick={handleCloseHistoryModal}>
          <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Lịch sử giao hàng - {selectedDroneHistory.droneCode}</h2>
              <button className="btn-close" onClick={handleCloseHistoryModal}>×</button>
            </div>

            <div className="history-content">
              <div className="history-summary">
                <span>Tổng số đơn đã giao: <strong>{selectedDroneHistory.totalDeliveries}</strong></span>
              </div>

              {historyLoading ? (
                <div className="history-loading">Đang tải...</div>
              ) : historyData.length === 0 ? (
                <div className="history-empty">Chưa có lịch sử giao hàng</div>
              ) : (
                <div className="history-list">
                  {historyData.map((item, index) => (
                    <div key={item._id || index} className="history-item">
                      <div className="history-item-header">
                        <span className="history-order-id">
                          #{item.orderId?._id ? item.orderId._id.slice(-8) : (typeof item.orderId === "string" ? item.orderId.slice(-8) : "N/A")}
                        </span>
                        {getHistoryStatusBadge(item.status)}
                      </div>
                      <div className="history-item-body">
                        <p><strong>Nhà hàng:</strong> {item.restaurantId?.name || "N/A"}</p>
                        <p><strong>Khách hàng:</strong> {item.customerName || "Khách hàng"}</p>
                        <p><strong>Địa chỉ:</strong> {item.customerAddress || "N/A"}</p>
                        <p><strong>Giá trị:</strong> {Number(item.totalPrice || 0).toLocaleString("vi-VN")}đ</p>
                        <p><strong>Bắt đầu:</strong> {formatDate(item.startTime)}</p>
                        {item.endTime && <p><strong>Kết thúc:</strong> {formatDate(item.endTime)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM / SỬA DRONE */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingDrone ? "Chỉnh sửa Drone" : "Thêm Drone mới"}</h2>
              <button className="btn-close" onClick={handleCloseModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Mã Drone *</label>
                <input
                  type="text"
                  name="droneCode"
                  value={formData.droneCode}
                  onChange={handleInputChange}
                  required
                  placeholder="VD: DRONE-001"
                />
              </div>

              <div className="form-group">
                <label>Trọng lượng khoang hàng (gram)</label>
                <input
                  type="number"
                  name="cargoWeight"
                  value={formData.cargoWeight}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Trạng thái Drone</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="available">Sẵn sàng (Available)</option>
                  <option value="delivering">Đang giao (Delivering)</option>
                  <option value="maintenance">Bảo trì (Maintenance)</option>
                  <option value="offline">Ngoại tuyến (Offline)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Trạng thái nắp khoang</label>
                <select
                  name="cargoLidStatus"
                  value={formData.cargoLidStatus}
                  onChange={handleInputChange}
                >
                  <option value="closed">Đang đóng</option>
                  <option value="open">Đang mở</option>
                </select>
              </div>

              <div className="form-group">
                <label>Mức pin (%)</label>
                <input
                  type="number"
                  name="batteryLevel"
                  value={formData.batteryLevel}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>
                  Hủy
                </button>
                <button type="submit" className="btn-submit">
                  {editingDrone ? "Cập nhật" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drones;
