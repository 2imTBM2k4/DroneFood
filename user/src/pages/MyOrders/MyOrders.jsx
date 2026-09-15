import { useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { StoreContext } from "../../context/StoreContext";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { Bike, Check, CircleX, Clock3, CookingPot, Package, PackageCheck, Truck, LogIn } from "lucide-react";
import DroneDelivery from "../../components/DroneDelivery/DroneDelivery";
import { SkeletonList } from "../../components/Skeleton/Skeleton";
import { EmptyState, ErrorState } from "../../../../shared/components/StateBlock";
import "./MyOrders.css"; // Giả sử bạn có file CSS này cho style nhất quán với light mode
import { formatVND } from "../../../../shared/utils/money";
import OrderReviewPrompt from "../../components/OrderReviewPrompt/OrderReviewPrompt";

const SHIPPER_WAIT_WINDOW_MS = 10 * 60 * 1000;

const formatRemainingTime = (remainingMs) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getTimelineDetails = (order) => {
  const isShipper = order.deliveryMethod === "shipper";
  const isFindingShipper = isShipper && order.shipperAssignmentStatus === "unassigned";
  const steps = isShipper
    ? [
        { key: "placed", label: "Đã đặt", Icon: PackageCheck },
        { key: "finding-shipper", label: "Tìm Shipper", Icon: Bike },
        { key: "preparing", label: "Đang chuẩn bị", Icon: CookingPot },
        { key: "delivering", label: "Đang giao", Icon: Truck },
        { key: "delivered", label: "Đã giao", Icon: Check },
      ]
    : [
        { key: "placed", label: "Đã đặt", Icon: PackageCheck },
        { key: "preparing", label: "Đang chuẩn bị", Icon: CookingPot },
        { key: "delivering", label: "Đang giao", Icon: Truck },
        { key: "delivered", label: "Đã giao", Icon: Check },
      ];

  if (order.orderStatus === "delivered") {
    return { steps, activeStep: steps.length - 1, message: "Đơn hàng đã được giao thành công." };
  }
  if (order.orderStatus === "delivering") {
    return { steps, activeStep: steps.length - 2, message: "Đơn hàng đang được giao đến bạn." };
  }
  if (isFindingShipper) {
    return {
      steps,
      activeStep: 1,
      message: order.orderStatus === "preparing"
        ? "Nhà hàng đang chuẩn bị, đồng thời tìm Shipper."
        : "Đang tìm Shipper gần nhà hàng.",
    };
  }
  if (isShipper && order.shipperAssignmentStatus === "expired") {
    return {
      steps,
      activeStep: 1,
      message: "Chưa tìm được Shipper. Hãy chọn tiếp tục tìm hoặc hủy đơn để hoàn tiền.",
    };
  }
  if (order.orderStatus === "preparing") {
    return {
      steps,
      activeStep: isShipper ? 2 : 1,
      message: isShipper && order.shipperAssignmentStatus === "accepted"
        ? "Shipper đã nhận đơn. Nhà hàng đang chuẩn bị."
        : "Nhà hàng đang chuẩn bị đơn hàng.",
    };
  }
  if (isShipper && order.shipperAssignmentStatus === "accepted") {
    return { steps, activeStep: 2, message: "Shipper đã nhận đơn. Chờ nhà hàng chuẩn bị món." };
  }
  return { steps, activeStep: 0, message: "Nhà hàng đang chờ xác nhận đơn hàng." };
};

const OrderStatusTimeline = ({ order, now }) => {
  const isWaitingForShipper = order.deliveryMethod === "shipper"
    && ["pending", "preparing"].includes(order.orderStatus)
    && order.shipperAssignmentStatus === "unassigned";
  const deadlineMs = order.shipperAssignmentDeadlineAt ? new Date(order.shipperAssignmentDeadlineAt).getTime() : null;
  const remainingMs = deadlineMs ? Math.max(0, deadlineMs - now) : null;

  if (order.orderStatus === "cancelled") {
    return (
      <section className="order-timeline order-timeline-cancelled" aria-label="Trạng thái đơn hàng: đã hủy">
        <CircleX size={20} aria-hidden="true" />
        <div>
          <strong>Đơn hàng đã hủy</strong>
          <p>{order.cancellationCode === "NO_SHIPPER_AVAILABLE" ? "Không có Shipper nào nhận đơn trong thời gian chờ." : "Đơn hàng không thể tiếp tục xử lý."}</p>
        </div>
      </section>
    );
  }
  if (order.orderStatus === "refund_pending") {
    return (
      <section className="order-timeline order-timeline-refund" aria-label="Trạng thái đơn hàng: chờ hoàn tiền">
        <Clock3 size={20} aria-hidden="true" />
        <div><strong>Đang chờ hoàn tiền</strong><p>Admin sẽ xác nhận sau khi đã chuyển tiền về tài khoản bạn cung cấp.</p></div>
      </section>
    );
  }

  const { steps, activeStep, message } = getTimelineDetails(order);
  const waitProgress = remainingMs === null ? 0 : Math.min(100, Math.max(0, ((SHIPPER_WAIT_WINDOW_MS - remainingMs) / SHIPPER_WAIT_WINDOW_MS) * 100));

  return (
    <section className="order-timeline" aria-label={`Trạng thái đơn hàng: ${message}`}>
      <div className="order-timeline-heading">
        <div>
          <span className="order-timeline-kicker">Theo dõi đơn hàng</span>
          <strong aria-live="polite">{message}</strong>
        </div>
        {isWaitingForShipper && remainingMs !== null && (
          <div className="shipper-countdown" aria-live="polite">
            <Clock3 size={18} aria-hidden="true" />
            <span>{remainingMs > 0 ? "Còn" : "Đang xác nhận"}</span>
            <time dateTime={`PT${Math.ceil(remainingMs / 1000)}S`}>{remainingMs > 0 ? formatRemainingTime(remainingMs) : "00:00"}</time>
          </div>
        )}
      </div>

      <ol className="order-timeline-steps">
        {steps.map(({ key, label, Icon }, index) => {
          const state = index < activeStep ? "done" : index === activeStep ? "active" : "upcoming";
          return (
            <li key={key} className={`order-timeline-step ${state}`}>
              <span className="order-timeline-dot" aria-hidden="true"><Icon size={16} /></span>
              <span className="order-timeline-label">{label}</span>
            </li>
          );
        })}
      </ol>

      {isWaitingForShipper && remainingMs !== null && (
        <div className="shipper-wait-progress" aria-label={`Đã chờ ${Math.round(waitProgress)} phần trăm thời gian tìm Shipper`}>
          <span style={{ width: `${waitProgress}%` }} />
        </div>
      )}
    </section>
  );
};

const MyOrders = () => {
  const { url, token, setShowLogin } = useContext(StoreContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDroneModal, setShowDroneModal] = useState(false);
  const [canReceiveOrder, setCanReceiveOrder] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundBank, setRefundBank] = useState({ bankName: "", accountNumber: "", accountHolder: "" });
  const [extendingSearchId, setExtendingSearchId] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const hasShipperAwaitingAcceptance = orders.some((order) => order.deliveryMethod === "shipper" && ["pending", "preparing"].includes(order.orderStatus) && order.shipperAssignmentStatus === "unassigned");
  const cancellationOrder = orders.find((item) => item._id === showCancelModal);
  const needsManualRefund = cancellationOrder?.paymentMethod === "PAYOS" && cancellationOrder.isPaid;

  const fetchOrders = useCallback(async ({ background = false } = {}) => {
    if (!token) {
      if (!background) setIsLoading(false);
      return;
    }
    try {
      if (!background) {
        setIsLoading(true);
        setLoadError(null);
      }
      const response = await axios.get(`${url}/api/order/userorders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        const nextOrders = response.data.data;
        setOrders(nextOrders);
      } else {
        throw new Error(response.data.message || "Failed to load orders");
      }
    } catch (error) {
      console.error("Fetch orders error:", error);
      if (!background) {
        setLoadError(
          error.response?.data?.message || error.message || "Failed to load orders"
        );
      }
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [token, url]);

  const confirmReceived = async (orderId) => {
    try {
      const payload = {
        orderId,
        status: "delivered",
        isPaid: true,
        paidAt: new Date().toISOString(),
      };

      const response = await axios.post(`${url}/api/order/status`, payload, {
        // Sửa route thành /status
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        toast.success("Delivery confirmed!");
        fetchOrders();
        setShowDroneModal(false);
        setSelectedOrder(null);
      } else {
        toast.error(response.data.message || "Update failed");
      }
    } catch (error) {
      toast.error("Update failed");
    }
  };

  const handleViewDelivery = (order) => {
    if (order.orderStatus === "delivering") {
      setSelectedOrder(order);
      setShowDroneModal(true);
    }
  };

  const handleDeliveryComplete = () => {
    if (selectedOrder) {
      setCanReceiveOrder((prev) => ({
        ...prev,
        [selectedOrder._id]: true,
      }));
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please enter a cancellation reason");
      return;
    }
    try {
      const order = orders.find((item) => item._id === showCancelModal);
      const needsManualRefund = order?.paymentMethod === "PAYOS" && order.isPaid;
      const response = await axios.post(
        needsManualRefund ? `${url}/api/refunds/request` : `${url}/api/order/status`,
        needsManualRefund
          ? { orderId: showCancelModal, reason: cancelReason, bank: refundBank }
          : { orderId: showCancelModal, status: "cancelled", reason: cancelReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success(needsManualRefund ? "Yêu cầu hoàn tiền đã được gửi." : "Order cancelled");
        setShowCancelModal(null);
        setCancelReason("");
        setRefundBank({ bankName: "", accountNumber: "", accountHolder: "" });
        fetchOrders();
      } else {
        toast.error(response.data.message || "Cancellation failed");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Cancellation failed");
    }
  };

  const handleReviewFlowChanged = (orderId, reviewFlow) => {
    setOrders((current) => current.map((order) =>
      order._id === orderId ? { ...order, reviewFlow } : order
    ));
  };

  const handleExtendShipperSearch = async (orderId) => {
    setExtendingSearchId(orderId);
    try {
      const response = await axios.post(
        `${url}/api/shippers/orders/${orderId}/extend-search`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.data.success) throw new Error(response.data.message || "Could not continue searching");
      toast.success("Hệ thống sẽ tiếp tục tìm Shipper trong 10 phút.");
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Could not continue searching");
    } finally {
      setExtendingSearchId(null);
    }
  };

  // Hàm helper để format date (giữ nguyên từ code cũ)
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Hàm helper cho status text và color (giữ nguyên)
  const getStatusText = (status) => {
    const statusMap = {
      pending: "Pending",
      refund_pending: "Refund pending",
      preparing: "Preparing",
      delivering: "Delivering",
      delivered: "Delivered",
      cancelled: "Cancelled",
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: "#ffc107",
      refund_pending: "#ff9500",
      preparing: "#17a2b8",
      delivering: "#007bff",
      delivered: "#28a745",
      cancelled: "#dc3545",
    };
    return colorMap[status] || "#6c757d";
  };

  useEffect(() => {
    fetchOrders();
    if (!token) return undefined;
    // The expiry job runs outside the API process, so polling is required to
    // Surface a shipper-search timeout without asking the customer to reload.
    const refreshId = window.setInterval(() => fetchOrders({ background: true }), 30000);
    return () => window.clearInterval(refreshId);
  }, [fetchOrders, token]);

  useEffect(() => {
    if (!hasShipperAwaitingAcceptance) return undefined;
    const refreshClock = () => setNow(Date.now());
    refreshClock();
    const timerId = window.setInterval(refreshClock, 1000);
    return () => window.clearInterval(timerId);
  }, [hasShipperAwaitingAcceptance]);

  return (
    <div className="my-orders">
      <h2>My Orders</h2>
      {isLoading ? (
        <SkeletonList count={3} height={190} />
      ) : !token ? (
        <EmptyState
          icon={LogIn}
          title="Sign in to see your orders"
          description="Your order history and live drone tracking live behind your account."
          actionLabel="Sign in"
          onAction={() => setShowLogin(true)}
        />
      ) : loadError ? (
        <ErrorState
          title="Could not load your orders"
          description={loadError}
          onRetry={fetchOrders}
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="When you place an order it'll appear here, with live drone tracking."
          actionLabel="Order something"
          onAction={() => navigate("/")}
        />
      ) : (
        <div className="my-orders-list">
          {orders.map((order) => (
            <div key={order._id} className="my-orders-card">
              <div className="order-header">
                <div className="order-info">
                  <h4>Order #{order._id.slice(-8).toUpperCase()}</h4>
                  <span className="order-date">
                    {formatDate(order.createdAt || order.orderDate)}
                  </span>
                </div>
                <div
                  className="order-status"
                  style={{ backgroundColor: getStatusColor(order.orderStatus) }}
                >
                  {getStatusText(order.orderStatus)}
                </div>
              </div>

              <div className="order-details">
                <div className="order-items">
                  <strong>Items:</strong>
                  <div className="items-list">
                    {order.orderItems?.map((item, index) => (
                      <div key={index} className="order-item">
                        <span className="item-name">
                          {item.name}
                          {item.selectedOptions?.length > 0 && (
                            <span className="item-options">
                              {item.selectedOptions
                                .map((option) => option.optionName)
                                .join(" · ")}
                            </span>
                          )}
                          {item.note && (
                            <span className="item-note">“{item.note}”</span>
                          )}
                        </span>
                        <span className="item-quantity">x{item.quantity}</span>
                        <span className="item-price">{formatVND(item.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="order-summary">
                  <div className="summary-row">
                    <span>Total:</span>
                    <strong>{formatVND(order.totalPrice)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Payment method:</span>
                    <span>
                      {order.paymentMethod === "COD"
                        ? "Cash on delivery"
                        : order.paymentMethod === "PAYOS" ? "PayOS" : "VNPay"}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span>Delivery method:</span>
                    <span>{order.deliveryMethod === "shipper" ? "Shipper" : "Drone"}</span>
                  </div>
                  <div className="summary-row summary-row-stacked">
                    <span>Delivery address:</span>
                    <span className="summary-address">
                      {[order.shippingAddress?.address, order.shippingAddress?.city]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                </div>
              </div>

              {order.refundStatus === "requested" && (
                <p className="refund-status" role="status">
                  {order.paymentMethod === "PAYOS"
                    ? "Yêu cầu hoàn tiền đang chờ Admin xử lý."
                    : `Hoàn tiền VNPay đã được yêu cầu. Mã yêu cầu: ${order.refundRequestId}.`}
                </p>
              )}
              {order.refundStatus === "failed" && (
                <p className="refund-status refund-status-failed" role="alert">
                  Chưa thể gửi yêu cầu hoàn tiền. Vui lòng liên hệ hỗ trợ.
                </p>
              )}

              <OrderStatusTimeline order={order} now={now} />

              <OrderReviewPrompt
                order={order}
                url={url}
                token={token}
                onFlowChanged={handleReviewFlowChanged}
              />

              {(order.orderStatus === "pending" || (
                order.orderStatus === "preparing" &&
                order.deliveryMethod === "shipper" &&
                order.shipperAssignmentStatus === "expired" &&
                order.paymentMethod === "PAYOS" &&
                order.isPaid
              )) && (
                <div className="order-actions">
                  {order.deliveryMethod === "shipper" && order.shipperAssignmentStatus === "expired" && order.paymentMethod === "PAYOS" && order.isPaid && (
                    <button
                      type="button"
                      onClick={() => handleExtendShipperSearch(order._id)}
                      className="continue-shipper-search-btn"
                      disabled={extendingSearchId === order._id}
                    >
                      {extendingSearchId === order._id ? "Đang tìm Shipper…" : "Tìm Shipper thêm 10 phút"}
                    </button>
                  )}
                  <button
                    onClick={() => setShowCancelModal(order._id)}
                    className="cancel-order-btn"
                  >
                    Cancel order
                  </button>
                </div>
              )}

              {order.orderStatus === "delivering" && (
                <div className="order-actions">
                  {order.deliveryMethod !== "shipper" && (
                    <button
                      onClick={() => handleViewDelivery(order)}
                      className="view-delivery-btn"
                    >
                      View delivery details
                    </button>
                  )}
                  <button
                    onClick={() => confirmReceived(order._id)}
                    className={`confirm-received-btn ${
                      canReceiveOrder[order._id] ? "enabled" : "disabled"
                    }`}
                    disabled={!canReceiveOrder[order._id]}
                  >
                    Confirm received
                  </button>
                </div>
              )}

              {order.cancellationCode === "NO_SHIPPER_AVAILABLE" && (
                <div className="shipper-timeout-notice" role="alert">
                  <div>
                    <strong>Không tìm được Shipper</strong>
                    <p>{order.reason || "Đã chờ 10 phút nhưng chưa có Shipper nhận đơn. Bạn có thể tiếp tục tìm hoặc hủy đơn để hoàn tiền."}</p>
                  </div>
                </div>
              )}

              {order.orderStatus === "cancelled" && order.reason && order.cancellationCode !== "NO_SHIPPER_AVAILABLE" && (
                <div className="cancel-reason">
                  <strong>Cancellation reason:</strong> {order.reason}
                </div>
              )}

              {order.orderStatus === "cancelled" && order.deliveryMethod === "shipper" && order.paymentMethod === "PAYOS" && order.isPaid && order.cancellationCode === "NO_SHIPPER_AVAILABLE" && !["requested", "paid"].includes(order.refundStatus) && (
                <div className="order-actions">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(order._id)}
                    className="continue-shipper-search-btn"
                  >
                    Gửi yêu cầu hoàn tiền
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div
          className="drone-modal-overlay"
          onClick={() => {
            setShowCancelModal(null);
            setCancelReason("");
          }}
        >
          <div
            className="cancel-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{needsManualRefund ? "Yêu cầu hoàn tiền" : "Cancel order"}</h3>
            <p>{needsManualRefund ? "Cho biết lý do và thông tin nhận tiền để Admin xử lý hoàn tiền." : "Please provide a reason for cancellation:"}</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter cancellation reason..."
              rows={3}
              className="cancel-reason-input"
            />
            {needsManualRefund && (
              <div className="refund-bank-fields">
                <p>Đơn đã thanh toán. Thông tin này chỉ được Admin dùng để hoàn tiền.</p>
                <label>Tên ngân hàng<input required value={refundBank.bankName} onChange={(event) => setRefundBank((current) => ({ ...current, bankName: event.target.value }))} /></label>
                <label>Số tài khoản<input required value={refundBank.accountNumber} onChange={(event) => setRefundBank((current) => ({ ...current, accountNumber: event.target.value }))} inputMode="numeric" /></label>
                <label>Tên chủ tài khoản<input required value={refundBank.accountHolder} onChange={(event) => setRefundBank((current) => ({ ...current, accountHolder: event.target.value }))} /></label>
              </div>
            )}
            <div className="cancel-modal-actions">
              <button
                onClick={() => {
                  setShowCancelModal(null);
                  setCancelReason("");
                  setRefundBank({ bankName: "", accountNumber: "", accountHolder: "" });
                }}
                className="cancel-modal-back-btn"
              >
                Go back
              </button>
              <button
                onClick={handleCancelOrder}
                className="cancel-modal-confirm-btn"
                disabled={!cancelReason.trim() || (() => {
                  return needsManualRefund && Object.values(refundBank).some((value) => !value.trim());
                })()}
              >
                {needsManualRefund ? "Gửi yêu cầu hoàn tiền" : "Confirm cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drone Delivery Modal */}
      {showDroneModal && selectedOrder && selectedOrder.deliveryMethod !== "shipper" && (
        <div
          className="drone-modal-overlay"
          onClick={() => setShowDroneModal(false)}
        >
          <div
            className="drone-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="drone-modal-close"
              onClick={() => setShowDroneModal(false)}
            >
              ✕
            </button>
            <DroneDelivery
              order={selectedOrder}
              onDeliveryComplete={handleDeliveryComplete}
            />
            {canReceiveOrder[selectedOrder._id] && (
              <div className="drone-modal-actions">
                <button
                  onClick={() => confirmReceived(selectedOrder._id)}
                  className="confirm-received-btn enabled"
                >
                  Confirm received
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrders;
