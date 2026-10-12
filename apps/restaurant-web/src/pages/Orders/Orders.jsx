import React, { useState, useEffect } from "react";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import "./Orders.css";
import { assets } from "../../assets/assets";
import io from "socket.io-client";
import { EmptyState, ErrorState } from "@drone-food/web-ui/components/StateBlock";
import { ClipboardList } from "lucide-react";
import { formatVND } from "@drone-food/web-ui/utils/money";

const Orders = ({ url }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState("all");
  // Cancelling asks for a reason, which needs a modal — so the flow splits in
  // two: open it here, finish in confirmCancel() once the owner submits.
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchAllOrders = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const token = localStorage.getItem("token");
      const headers = token ? { token } : {};
      const response = await axios.get(url + "/api/order/list", { headers });
      if (response.data.success) {
        // Normalize và sắp xếp order mới nhất lên đầu
        const normalizedOrders = (response.data.data || [])
          .map((order) => ({
            ...order,
            orderStatus: order.orderStatus?.toLowerCase() || "pending",
          }))
          .sort(
            (a, b) =>
              new Date(b.createdAt || b.orderDate) -
              new Date(a.createdAt || a.orderDate)
          ); // SẮP XẾP MỚI NHẤT LÊN ĐẦU

        setOrders(normalizedOrders);
      } else {
        throw new Error(response.data.message || "Error fetching orders");
      }
    } catch (error) {
      console.error("Fetch orders error:", error.response?.data || error);
      // Shown inline with a retry button instead of only as a toast the
      // owner may have missed.
      setLoadError(
        error.response?.data?.message || error.message || "Error fetching orders"
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };
  const updateStatus = async (orderId, status, reason = "") => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        notificationService.error(
          "Phiên đăng nhập đã hết hạn",
          "Vui lòng đăng nhập lại với tài khoản chủ nhà hàng để cập nhật đơn hàng.",
          { audience: "restaurant", key: `restaurant-order-auth-${orderId}` }
        );
        return;
      }

      // Second line of defence: the modal already requires a reason, and so
      // does the API, but never send a cancellation without one.
      if (status === "cancelled" && !reason.trim()) {
        notificationService.error(
          "Chưa nhập lý do hủy đơn",
          "Vui lòng nhập lý do trước khi xác nhận hủy đơn hàng.",
          { audience: "restaurant", key: `restaurant-order-cancel-reason-${orderId}` }
        );
        return;
      }

      // CHỈ GỌI /status - BỎ FALLBACK /update
      const response = await axios.post(
        url + "/api/order/status",
        {
          orderId,
          status,
          reason,
        },
        { headers: { token } }
      );

      if (response.data.success) {
        await fetchAllOrders();
        notificationService.success("Cập nhật trạng thái thành công", undefined, { audience: "restaurant", key: `restaurant-order-status-success-${orderId}-${status}` });
      } else {
        notificationService.error(
          "Không thể cập nhật trạng thái đơn hàng",
          response.data.message || "Vui lòng thử cập nhật trạng thái đơn hàng lại.",
          {
            audience: "restaurant",
            priority: "high",
            persistent: true,
            duration: 0,
            key: `restaurant-order-status-${orderId}-${status}`,
            actions: [{ label: "Thử lại", onClick: () => updateStatus(orderId, status, reason) }],
          }
        );
      }
    } catch (error) {
      console.error("Update status error:", error.response?.data || error);
      const message = error.response?.status === 401 || error.response?.status === 403
        ? error.response?.data?.message || "Bạn không có quyền cập nhật đơn hàng này."
        : error.response?.status === 404
          ? "Không tìm thấy dịch vụ cập nhật đơn hàng. Vui lòng thử lại sau."
          : error.response?.data?.message || "Không thể cập nhật trạng thái đơn hàng.";
      notificationService.error(
        "Không thể cập nhật trạng thái đơn hàng",
        message,
        {
          audience: "restaurant",
          priority: "high",
          persistent: true,
          duration: 0,
          key: `restaurant-order-status-${orderId}-${status}`,
          actions: [{ label: "Thử lại", onClick: () => updateStatus(orderId, status, reason) }],
        }
      );
    }
  };
  const closeCancelModal = () => {
    // Always clear the target, or the next cancel could hit the wrong order.
    setCancelTarget(null);
    setCancelReason("");
    setCancelling(false);
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !cancelReason.trim() || cancelling) return;
    setCancelling(true);
    await updateStatus(cancelTarget._id, "cancelled", cancelReason);
    closeCancelModal();
  };

  useEffect(() => {
    fetchAllOrders();

    const token = localStorage.getItem("token");
    const socket = io(url, { auth: { token } });
    const restaurantId = localStorage.getItem("restaurantId");
    if (restaurantId) {
      socket.emit("joinRestaurant", restaurantId);
    } else {
      notificationService.warning(
        "Chưa thể bật thông báo đơn hàng",
        "Vui lòng đăng nhập lại để nhận thông báo đơn hàng mới.",
        { audience: "restaurant", key: "restaurant-notifications-auth" }
      );
    }

    socket.on("newOrder", (newOrder) => {
      const orderCode = newOrder._id?.slice(-8)?.toUpperCase() || "mới";
      notificationService.info(
        "Có đơn hàng mới",
        `Đơn #${orderCode} - ${formatVND(newOrder.totalPrice)}`,
        {
          audience: "restaurant",
          key: `new-order-${newOrder._id}`,
          actions: [
            {
              label: "Xem đơn hàng",
              onClick: () => {
                setFilter("all");
                requestAnimationFrame(() => {
                  document
                    .getElementById(`restaurant-order-${newOrder._id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                });
              },
            },
          ],
        }
      );
      // Normalize status và thêm vào đầu danh sách
      newOrder.orderStatus = newOrder.orderStatus?.toLowerCase() || "pending";
      setOrders((prev) => [newOrder, ...prev]); // THÊM MỚI VÀO ĐẦU DANH SÁCH
    });

    socket.on("connect_error", () => {
      notificationService.error(
        "Không thể kết nối thông báo đơn hàng",
        "Hệ thống sẽ tự thử kết nối lại. Vui lòng kiểm tra kết nối mạng.",
        { audience: "restaurant", key: "restaurant-notification-connection" }
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [url]);

  // The kitchen reads this, so each line spells out its options and note
  // rather than collapsing to a comma-separated string.
  const renderItems = (orderItems) => {
    if (!orderItems || orderItems.length === 0) return "No items";
    return (
      <ul className="order-line-list">
        {orderItems.map((item, idx) => (
          <li key={idx} className="order-line">
            <span className="order-line-main">
              {item.name} <span className="order-line-qty">x{item.quantity}</span>
            </span>
            {item.selectedOptions?.length > 0 && (
              <span className="order-line-options">
                {item.selectedOptions
                  .map((option) => `${option.groupName}: ${option.optionName}`)
                  .join(" · ")}
              </span>
            )}
            {item.note && (
              <span className="order-line-note">Note: {item.note}</span>
            )}
          </li>
        ))}
      </ul>
    );
  };

  // Tabs the owner can filter by, in the order an order moves through them.
  const STATUS_TABS = [
    "all",
    "pending",
    "preparing",
    "delivering",
    "delivered",
    "cancelled",
  ];

  const counts = orders.reduce(
    (acc, o) => {
      acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
      return acc;
    },
    { all: orders.length }
  );

  const visibleOrders =
    filter === "all" ? orders : orders.filter((o) => o.orderStatus === filter);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="order-page">
        <h1 className="page-title">Orders</h1>
        <div className="order-skeleton-list" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="order-skeleton-card">
              <div className="order-skeleton-head">
                <div className="skeleton skeleton-circle order-skeleton-icon" />
                <div className="order-skeleton-meta">
                  <div className="skeleton skeleton-text" style={{ width: 150 }} />
                  <div className="skeleton skeleton-text" style={{ width: 110 }} />
                </div>
                <div className="skeleton order-skeleton-badge" />
              </div>
              <div className="skeleton skeleton-text" style={{ width: "70%" }} />
              <div className="skeleton skeleton-text" style={{ width: "45%" }} />
              <div className="skeleton skeleton-text" style={{ width: "58%" }} />
              <div className="order-skeleton-actions">
                <div className="skeleton order-skeleton-btn" />
                <div className="skeleton order-skeleton-btn" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="order-page">
        <h1 className="page-title">Orders</h1>
        <ErrorState
          title="Could not load orders"
          description={loadError}
          onRetry={fetchAllOrders}
        />
      </div>
    );
  }

  return (
    <div className="order-page">
      <h1 className="page-title">Orders</h1>
      <div className="order-header-info">
        <p>
          <strong>{orders.length}</strong> orders in total · newest first · this
          page updates live
        </p>
      </div>

      <div className="order-tabs" role="tablist" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={filter === tab}
            className={`order-tab ${filter === tab ? "active" : ""}`}
            onClick={() => setFilter(tab)}
          >
            {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className="order-tab-count">{counts[tab] || 0}</span>
          </button>
        ))}
      </div>

      <div className="order-list">
        {visibleOrders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={filter === "all" ? "No orders yet" : `No ${filter} orders`}
            description={
              filter === "all"
                ? "New orders land here the moment a customer places one — this page updates live."
                : "Nothing in this status right now. Pick another tab to see the rest."
            }
          />
        ) : (
          visibleOrders.map((order, index) => (
            <div id={`restaurant-order-${order._id}`} key={order._id || index} className="order-item">
              <div className="order-item-header">
                <img src={assets.parcel_icon} alt="Order" />
                <div className="order-meta">
                  <span className="order-id">
                    Order #{order._id?.slice(-8)?.toUpperCase()}
                  </span>
                  <span className="order-date">
                    {formatDate(order.createdAt || order.orderDate)}
                  </span>
                </div>
                <div
                  className={`order-status-badge status-${order.orderStatus}`}
                >
                  {order.orderStatus}
                </div>
              </div>

              <div className="order-item-content">
                <div className="order-item-details">
                  {/* div, not p — renderItems returns a list. */}
                  <div className="order-item-food">
                    <strong>Items:</strong> {renderItems(order.orderItems)}
                  </div>
                  <p className="order-item-name">
                    <strong>Customer:</strong>{" "}
                    {order.shippingAddress?.fullName || "N/A"}
                  </p>
                  <div className="order-item-address">
                    <p>
                      <strong>Address:</strong>{" "}
                      {order.shippingAddress?.address || ""},
                    </p>
                    <p>
                      {order.shippingAddress?.city || ""},{" "}
                      {order.shippingAddress?.state || ""},{" "}
                      {order.shippingAddress?.country || ""},{" "}
                      {order.shippingAddress?.zipCode || ""}
                    </p>
                  </div>
                  <p className="order-item-phone">
                    <strong>Phone:</strong>{" "}
                    {order.shippingAddress?.phone || "N/A"}
                  </p>
                </div>
                <div className="order-item-summary">
                  <p>
                    <strong>Items:</strong> {order.orderItems?.length || 0}
                  </p>
                  <p>
                    <strong>Total:</strong> {formatVND(order.totalPrice)}
                  </p>
                  <p>
                    <strong>Payment:</strong> {order.paymentMethod || "N/A"}
                  </p>
                </div>
              </div>

              {order.orderStatus === "cancelled" && order.reason && (
                <p className="cancel-reason">
                  <strong>Reason:</strong> {order.reason}
                </p>
              )}

              <div className="status-actions">
                {order.orderStatus === "pending" && (
                  <div className="status-buttons">
                    <button
                      className="btn-accept"
                      onClick={() => updateStatus(order._id, "preparing")}
                      disabled={order.deliveryMethod === "shipper" && order.shipperAssignmentStatus !== "accepted"}
                      aria-describedby={order.deliveryMethod === "shipper" && order.shipperAssignmentStatus !== "accepted" ? `shipper-wait-${order._id}` : undefined}
                    >
                      Accept order
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => setCancelTarget(order)}
                    >
                      Reject
                    </button>
                    {order.deliveryMethod === "shipper" && order.shipperAssignmentStatus !== "accepted" && (
                      <p id={`shipper-wait-${order._id}`} className="shipper-assignment-wait" role="status">
                        Đang tìm Shipper. Bạn có thể bắt đầu chuẩn bị khi Shipper đã nhận đơn.
                      </p>
                    )}
                  </div>
                )}
                {order.orderStatus === "preparing" && order.deliveryMethod !== "shipper" && (
                  <div className="status-buttons">
                    <button
                      className="btn-deliver"
                      onClick={() => updateStatus(order._id, "delivering")}
                      disabled={order.deliveryMethod === "drone" && order.dronePhase !== "awaiting_restaurant_handover"}
                    >
                      {order.deliveryMethod === "drone"
                        ? order.dronePhase === "awaiting_restaurant_handover"
                          ? "Bàn giao cho Drone"
                          : "Đang chờ Drone tới..."
                        : "Hand over to drone"}
                    </button>
                    {order.deliveryMethod === "drone" && order.dronePhase !== "awaiting_restaurant_handover" && (
                      <p className="drone-handover-wait" style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                        Trạng thái Drone: <strong>{order.dronePhase || "chờ gán"}</strong>. Nút sẽ bật khi Drone hạ cánh tại nhà hàng.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {cancelTarget && (
        <div
          className="edit-modal cancel-modal"
          onClick={closeCancelModal}
          role="dialog"
          aria-modal="true"
          aria-label="Reject order"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reject order</h3>
              <span className="close" onClick={closeCancelModal}>
                &times;
              </span>
            </div>

            <p className="cancel-modal-lead">
              Order #{cancelTarget._id?.slice(-8)?.toUpperCase()} for{" "}
              <strong>
                {cancelTarget.shippingAddress?.fullName || "the customer"}
              </strong>{" "}
              will be cancelled. The reason is shown to them, so be clear.
            </p>

            <label className="cancel-modal-label" htmlFor="cancel-reason">
              Reason for cancellation
            </label>
            <textarea
              id="cancel-reason"
              className="cancel-modal-input"
              rows={3}
              maxLength={500}
              autoFocus
              placeholder="e.g. Out of stock — we've run out of this dish tonight."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <span className="cancel-modal-count">
              {cancelReason.length}/500
            </span>

            <div className="modal-buttons">
              <button
                type="button"
                className="cancel-btn"
                onClick={closeCancelModal}
                disabled={cancelling}
              >
                Keep order
              </button>
              <button
                type="button"
                className="btn-reject"
                onClick={confirmCancel}
                disabled={!cancelReason.trim() || cancelling}
              >
                {cancelling ? "Rejecting…" : "Reject order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
