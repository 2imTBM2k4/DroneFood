import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./Orders.css";
import { assets } from "../../assets/assets";
import io from "socket.io-client";
import { EmptyState, ErrorState } from "../../../../shared/components/StateBlock";
import { ClipboardList } from "lucide-react";
import { formatVND } from "../../../../shared/utils/money";

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
        toast.error("Please login as restaurant owner");
        return;
      }

      // Second line of defence: the modal already requires a reason, and so
      // does the API, but never send a cancellation without one.
      if (status === "cancelled" && !reason.trim()) {
        toast.error("Reason is required for cancellation");
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
        toast.success("Status updated");
      } else {
        toast.error(response.data.message || "Error updating status");
      }
    } catch (error) {
      console.error("Update status error:", error.response?.data || error);
      // Xử lý lỗi chi tiết hơn (không còn 404 fallback)
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error(
          error.response?.data?.message ||
            "Unauthorized - Check login/restaurant"
        );
      } else if (error.response?.status === 404) {
        toast.error("Endpoint not found - Check server routes");
      } else {
        toast.error(error.response?.data?.message || "Error updating status");
      }
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
      toast.warn("Please re-login to enable notifications");
    }

    socket.on("newOrder", (newOrder) => {
      toast.info("Có đơn hàng mới!");
      // Normalize status và thêm vào đầu danh sách
      newOrder.orderStatus = newOrder.orderStatus?.toLowerCase() || "pending";
      setOrders((prev) => [newOrder, ...prev]); // THÊM MỚI VÀO ĐẦU DANH SÁCH
    });

    socket.on("connect_error", () => {
      toast.error("Notification connection failed");
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
            <div key={order._id || index} className="order-item">
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
                    >
                      Hand over to drone
                    </button>
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
