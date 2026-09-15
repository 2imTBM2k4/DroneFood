import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { StoreContext } from "../../context/StoreContext";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  Package,
  LogIn,
  Clock,
  MapPin,
  Bike,
  Navigation,
  ChevronRight,
  Store,
  UtensilsCrossed,
  AlertCircle,
  XCircle,
  X,
  RotateCcw,
  Search,
} from "lucide-react";
import { SkeletonList } from "../../components/Skeleton/Skeleton";
import { EmptyState, ErrorState } from "../../../../shared/components/StateBlock";
import "./MyOrders.css";
import { formatVND } from "../../../../shared/utils/money";
import OrderReviewPrompt from "../../components/OrderReviewPrompt/OrderReviewPrompt";

const STATUS_CONFIG = {
  pending_payment: { label: "Chờ thanh toán", colorClass: "status-pending" },
  pending: { label: "Chờ xác nhận", colorClass: "status-pending" },
  preparing: { label: "Đang chuẩn bị", colorClass: "status-preparing" },
  delivering: { label: "Đang giao", colorClass: "status-delivering" },
  delivered: { label: "Đã giao", colorClass: "status-delivered" },
  cancelled: { label: "Đã hủy", colorClass: "status-cancelled" },
  refund_pending: { label: "Chờ hoàn tiền", colorClass: "status-refund-pending" },
};

const TAB_OPTIONS = [
  { id: "all", label: "Tất cả" },
  { id: "active", label: "Đang xử lý" },
  { id: "delivered", label: "Đã giao" },
  { id: "cancelled", label: "Đã hủy" },
];

const hasShipperAcceptedOrder = (order) =>
  order.deliveryMethod === "shipper" &&
  (Boolean(order.shipperId) || ["accepted", "picked_up", "completed"].includes(order.shipperAssignmentStatus));

const isCancellationLockedByShipper = (order) =>
  hasShipperAcceptedOrder(order) && ["pending", "preparing", "delivering"].includes(order.orderStatus);

const canShowCancellationAction = (order) =>
  !isCancellationLockedByShipper(order) &&
  (order.orderStatus === "pending" ||
    order.orderStatus === "pending_payment" ||
    (order.orderStatus === "preparing" &&
      order.deliveryMethod === "shipper" &&
      order.shipperAssignmentStatus === "expired" &&
      order.paymentMethod === "PAYOS" &&
      order.isPaid));

const MyOrders = () => {
  const { url, token, setShowLogin } = useContext(StoreContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundBank, setRefundBank] = useState({ bankName: "", accountNumber: "", accountHolder: "" });
  const [extendingSearchId, setExtendingSearchId] = useState(null);
  const [retryingPaymentId, setRetryingPaymentId] = useState(null);

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
        setOrders(response.data.data || []);
      } else {
        throw new Error(response.data.message || "Không thể tải danh sách đơn hàng");
      }
    } catch (error) {
      console.error("Fetch orders error:", error);
      if (!background) {
        setLoadError(
          error.response?.data?.message || error.message || "Không thể tải danh sách đơn hàng"
        );
      }
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [token, url]);

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      toast.error("Vui lòng nhập lý do hủy đơn");
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
        toast.success(needsManualRefund ? "Yêu cầu hoàn tiền đã được gửi thành công." : "Đã hủy đơn hàng.");
        setShowCancelModal(null);
        setCancelReason("");
        setRefundBank({ bankName: "", accountNumber: "", accountHolder: "" });
        fetchOrders();
      } else {
        toast.error(response.data.message || "Hủy đơn thất bại");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Hủy đơn thất bại");
    }
  };

  const handleReviewFlowChanged = (orderId, reviewFlow) => {
    setOrders((current) =>
      current.map((order) =>
        order._id === orderId ? { ...order, reviewFlow } : order
      )
    );
  };

  const handleExtendShipperSearch = async (orderId) => {
    setExtendingSearchId(orderId);
    try {
      const response = await axios.post(
        `${url}/api/shippers/orders/${orderId}/extend-search`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.data.success) {
        throw new Error(response.data.message || "Không thể tiếp tục tìm kiếm shipper");
      }
      toast.success("Hệ thống sẽ tiếp tục tìm Shipper trong 10 phút.");
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Không thể tiếp tục tìm kiếm");
    } finally {
      setExtendingSearchId(null);
    }
  };

  const handleRetryPayosPayment = async (orderId) => {
    setRetryingPaymentId(orderId);
    try {
      const response = await axios.post(
        `${url}/api/order/retry-payos`,
        { orderId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.data.success || !response.data.checkoutUrl) {
        throw new Error(response.data.message || "Không thể tạo lại liên kết thanh toán");
      }
      window.location.assign(response.data.checkoutUrl);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Không thể tạo lại liên kết thanh toán");
      setRetryingPaymentId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    fetchOrders();
    if (!token) return undefined;
    const refreshId = window.setInterval(() => fetchOrders({ background: true }), 30000);
    return () => window.clearInterval(refreshId);
  }, [fetchOrders, token]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = {
      all: orders.length,
      active: orders.filter((o) => ["pending_payment", "pending", "preparing", "delivering"].includes(o.orderStatus)).length,
      delivered: orders.filter((o) => o.orderStatus === "delivered").length,
      cancelled: orders.filter((o) => ["cancelled", "refund_pending"].includes(o.orderStatus)).length,
    };
    return counts;
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Tab filter
      if (activeTab === "active" && !["pending_payment", "pending", "preparing", "delivering"].includes(order.orderStatus)) return false;
      if (activeTab === "delivered" && order.orderStatus !== "delivered") return false;
      if (activeTab === "cancelled" && !["cancelled", "refund_pending"].includes(order.orderStatus)) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesId = order._id?.toLowerCase().includes(query);
        const matchesRestaurant = order.restaurantId?.name?.toLowerCase().includes(query);
        const matchesItem = order.orderItems?.some((item) => item.name?.toLowerCase().includes(query));
        return matchesId || matchesRestaurant || matchesItem;
      }
      return true;
    });
  }, [orders, activeTab, searchQuery]);

  const getItemImage = (item) => {
    const raw = item.product?.image || item.image;
    if (!raw) return null;
    return raw.startsWith("http") ? raw : `${url}/images/${raw}`;
  };

  const getPaymentBadge = (method, isPaid) => {
    const methodNames = {
      COD: "Tiền mặt khi nhận hàng",
      PAYOS: "PayOS",
      VNPAY: "VNPay",
    };
    return (
      <span className="order-payment-pill">
        <span className="payment-name">{methodNames[method] || method}</span>
        <span className={`payment-status ${isPaid ? "paid" : "unpaid"}`}>
          {isPaid ? "Đã thanh toán" : "Chưa thanh toán"}
        </span>
      </span>
    );
  };

  return (
    <div className="my-orders-page">
      <div className="my-orders-container">
        {/* Header Section */}
        <header className="my-orders-hero">
          <div className="my-orders-hero-text">
            <span className="my-orders-eyebrow">Quản lý mua hàng</span>
            <h1>Đơn hàng của tôi</h1>
            <p className="my-orders-subtitle">
              Theo dõi lộ trình giao hàng trực tiếp bằng Drone và Shipper mọi lúc, mọi nơi.
            </p>
          </div>

          {token && orders.length > 0 && (
            <button
              type="button"
              className="my-orders-refresh-btn"
              onClick={() => fetchOrders()}
              disabled={isLoading}
              title="Làm mới danh sách"
            >
              <RotateCcw size={16} className={isLoading ? "spin-icon" : ""} />
              <span>Cập nhật</span>
            </button>
          )}
        </header>

        {/* Content Section */}
        {isLoading ? (
          <div className="my-orders-loading-wrap">
            <SkeletonList count={3} height={200} />
          </div>
        ) : !token ? (
          <div className="my-orders-empty-state">
            <EmptyState
              icon={LogIn}
              title="Đăng nhập để xem đơn hàng"
              description="Lịch sử đơn hàng, hành trình bay của Drone và trạng thái giao hàng được lưu trong tài khoản của bạn."
              actionLabel="Đăng nhập ngay"
              onAction={() => setShowLogin(true)}
            />
          </div>
        ) : loadError ? (
          <div className="my-orders-error-wrap">
            <ErrorState
              title="Không thể tải danh sách đơn hàng"
              description={loadError}
              onRetry={() => fetchOrders()}
            />
          </div>
        ) : orders.length === 0 ? (
          <div className="my-orders-empty-state">
            <EmptyState
              icon={Package}
              title="Bạn chưa có đơn hàng nào"
              description="Khám phá các món ăn thơm ngon và trải nghiệm công nghệ giao hàng bằng Drone ngay hôm nay!"
              actionLabel="Khám phá món ngon"
              onAction={() => navigate("/")}
            />
          </div>
        ) : (
          <>
            {/* Filter Bar & Tabs */}
            <div className="my-orders-filter-bar">
              <nav className="my-orders-tabs" aria-label="Bộ lọc trạng thái">
                {TAB_OPTIONS.map((tab) => {
                  const count = tabCounts[tab.id];
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`my-orders-tab ${isActive ? "active" : ""}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <span>{tab.label}</span>
                      {count > 0 && (
                        <span className={`my-orders-tab-count ${isActive ? "active" : ""}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="my-orders-search">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Tìm theo mã đơn, món ăn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Tìm kiếm đơn hàng"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearchQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Orders Feed */}
            {filteredOrders.length === 0 ? (
              <div className="my-orders-no-match">
                <Package size={40} className="no-match-icon" />
                <h3>Không tìm thấy đơn hàng phù hợp</h3>
                <p>Thử chọn tab khác hoặc tìm kiếm với từ khóa khác.</p>
                <button
                  type="button"
                  className="reset-filter-btn"
                  onClick={() => {
                    setActiveTab("all");
                    setSearchQuery("");
                  }}
                >
                  Xem tất cả đơn hàng
                </button>
              </div>
            ) : (
              <div className="my-orders-feed">
                {filteredOrders.map((order) => {
                  const statusInfo = STATUS_CONFIG[order.orderStatus] || {
                    label: order.orderStatus,
                    colorClass: "status-default",
                  };
                  const isDrone = order.deliveryMethod === "drone";
                  const orderCode = order._id.slice(-8).toUpperCase();
                  const orderDate = formatDate(order.createdAt || order.orderDate);
                  const restaurantName = order.restaurantId?.name || "Nhà hàng đối tác";

                  return (
                    <article key={order._id} className="order-card">
                      {/* Card Header */}
                      <div className="order-card-header">
                        <div className="order-card-restaurant">
                          <div className="restaurant-icon-box">
                            <Store size={18} />
                          </div>
                          <div className="restaurant-meta">
                            <h3 className="restaurant-name">{restaurantName}</h3>
                            <div className="order-meta-chips">
                              <span className="order-code">#{orderCode}</span>
                              <span className="order-dot">·</span>
                              <span className="order-date-text">
                                <Clock size={13} />
                                {orderDate}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="order-card-badges">
                          <div className={`delivery-method-tag ${isDrone ? "drone" : "shipper"}`}>
                            {isDrone ? (
                              <>
                                <Navigation size={13} className="drone-nav-icon" />
                                <span>Giao bằng Drone</span>
                              </>
                            ) : (
                              <>
                                <Bike size={13} />
                                <span>Tài xế giao</span>
                              </>
                            )}
                          </div>

                          <div className={`order-status-pill ${statusInfo.colorClass}`}>
                            {order.orderStatus === "delivering" && (
                              <span className="live-pulse-dot" aria-hidden="true" />
                            )}
                            <span>{statusInfo.label}</span>
                          </div>
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="order-items-preview">
                        <div className="order-items-list">
                          {order.orderItems?.map((item, idx) => {
                            const imgSrc = getItemImage(item);
                            return (
                              <div key={`${item.name}-${idx}`} className="order-item-row">
                                <div className="item-thumbnail-box">
                                  {imgSrc ? (
                                    <img
                                      src={imgSrc}
                                      alt={item.name}
                                      className="item-thumbnail-img"
                                      onError={(e) => {
                                        e.target.style.display = "none";
                                        if (e.target.nextSibling) {
                                          e.target.nextSibling.style.display = "flex";
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className="item-thumbnail-fallback"
                                    style={{ display: imgSrc ? "none" : "flex" }}
                                  >
                                    <UtensilsCrossed size={16} />
                                  </div>
                                </div>

                                <div className="item-info-col">
                                  <div className="item-title-line">
                                    <span className="item-name">{item.name}</span>
                                    <span className="item-qty">×{item.quantity}</span>
                                  </div>

                                  {item.selectedOptions?.length > 0 && (
                                    <div className="item-options-line">
                                      {item.selectedOptions.map((opt) => opt.optionName).join(" · ")}
                                    </div>
                                  )}

                                  {item.note && (
                                    <div className="item-note-line">
                                      Ghi chú: “{item.note}”
                                    </div>
                                  )}
                                </div>

                                <div className="item-price-col">
                                  {formatVND(item.price * item.quantity)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Special Alert Banners */}
                      {order.refundStatus === "requested" && (
                        <div className="order-alert-banner alert-warning" role="status">
                          <AlertCircle size={16} />
                          <span>
                            {order.paymentMethod === "PAYOS"
                              ? "Yêu cầu hoàn tiền đang chờ Ban Quản trị xét duyệt và xử lý."
                              : `Yêu cầu hoàn tiền VNPay đã được gửi. Mã yêu cầu: ${order.refundRequestId}.`}
                          </span>
                        </div>
                      )}

                      {order.refundStatus === "failed" && (
                        <div className="order-alert-banner alert-danger" role="alert">
                          <XCircle size={16} />
                          <span>Chưa thể gửi yêu cầu hoàn tiền. Vui lòng liên hệ bộ phận hỗ trợ khách hàng.</span>
                        </div>
                      )}

                      {order.cancellationCode === "NO_SHIPPER_AVAILABLE" && (
                        <div className="order-alert-banner alert-warning" role="alert">
                          <AlertCircle size={16} />
                          <div>
                            <strong>Không tìm được tài xế nhận đơn</strong>
                            <p>
                              {order.reason ||
                                "Đã quá 10 phút nhưng chưa có tài xế nhận đơn. Bạn có thể gia hạn tìm kiếm hoặc gửi yêu cầu hoàn tiền."}
                            </p>
                          </div>
                        </div>
                      )}

                      {isCancellationLockedByShipper(order) && (
                        <div className="order-alert-banner alert-neutral cancellation-lock-banner" role="status">
                          <Bike size={16} aria-hidden="true" />
                          <div>
                            <strong>Đơn đã có tài xế nhận</strong>
                            <p>Bạn không thể hủy đơn hoặc gửi yêu cầu hoàn tiền ở thời điểm này.</p>
                          </div>
                        </div>
                      )}

                      {order.orderStatus === "cancelled" &&
                        order.reason &&
                        order.cancellationCode !== "NO_SHIPPER_AVAILABLE" && (
                          <div className="order-alert-banner alert-neutral">
                            <span className="cancel-reason-label">Lý do hủy đơn:</span>
                            <span className="cancel-reason-text">{order.reason}</span>
                          </div>
                        )}

                      {/* Review Flow Integration */}
                      <OrderReviewPrompt
                        order={order}
                        url={url}
                        token={token}
                        onFlowChanged={handleReviewFlowChanged}
                      />

                      {/* Card Footer */}
                      <div className="order-card-footer">
                        <div className="order-footer-details">
                          <div className="footer-address">
                            <MapPin size={14} className="address-icon" />
                            <span className="address-text">
                              {[
                                order.shippingAddress?.fullName,
                                order.shippingAddress?.address,
                                order.shippingAddress?.city,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "Chưa có địa chỉ"}
                            </span>
                          </div>

                          <div className="footer-payment">
                            {getPaymentBadge(order.paymentMethod, order.isPaid)}
                          </div>
                        </div>

                        <div className="order-footer-actions">
                          <div className="order-total-block">
                            <span className="total-label">Tổng tiền</span>
                            <span className="total-amount">{formatVND(order.totalPrice)}</span>
                          </div>

                          <div className="order-btn-group">
                            {order.paymentMethod === "PAYOS" &&
                              !order.isPaid &&
                              order.orderStatus === "pending_payment" && (
                                <button
                                  type="button"
                                  className="btn-retry-payment"
                                  onClick={() => handleRetryPayosPayment(order._id)}
                                  disabled={retryingPaymentId === order._id}
                                  aria-busy={retryingPaymentId === order._id}
                                >
                                  <RotateCcw size={14} aria-hidden="true" className={retryingPaymentId === order._id ? "spin-icon" : ""} />
                                  <span>{retryingPaymentId === order._id ? "Đang tạo link…" : "Thanh toán lại"}</span>
                                </button>
                              )}
                            {/* Actions for Shipper timeout / Cancel */}
                            {canShowCancellationAction(order) && (
                              <>
                                {order.deliveryMethod === "shipper" &&
                                  order.shipperAssignmentStatus === "expired" &&
                                  order.paymentMethod === "PAYOS" &&
                                  order.isPaid && (
                                    <button
                                      type="button"
                                      onClick={() => handleExtendShipperSearch(order._id)}
                                      className="btn-extend-search"
                                      disabled={extendingSearchId === order._id}
                                    >
                                      {extendingSearchId === order._id
                                        ? "Đang tìm kiếm…"
                                        : "Tìm Shipper thêm 10 phút"}
                                    </button>
                                  )}
                                <button
                                  type="button"
                                  onClick={() => setShowCancelModal(order._id)}
                                  className="btn-cancel-order"
                                >
                                  Hủy đơn
                                </button>
                              </>
                            )}

                            {order.orderStatus === "cancelled" &&
                              order.deliveryMethod === "shipper" &&
                              order.paymentMethod === "PAYOS" &&
                              order.isPaid &&
                              order.cancellationCode === "NO_SHIPPER_AVAILABLE" &&
                              !["requested", "paid"].includes(order.refundStatus) && (
                                <button
                                  type="button"
                                  onClick={() => setShowCancelModal(order._id)}
                                  className="btn-refund-request"
                                >
                                  Yêu cầu hoàn tiền
                                </button>
                              )}

                            <button
                              type="button"
                              className="btn-view-details"
                              onClick={() => navigate(`/myorders/${order._id}`)}
                            >
                              <span>{order.orderStatus === "delivering" ? "Theo dõi đơn" : "Chi tiết đơn"}</span>
                              <ChevronRight size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div
          className="order-modal-backdrop"
          onClick={() => {
            setShowCancelModal(null);
            setCancelReason("");
          }}
        >
          <div
            className="order-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
          >
            <div className="order-modal-header">
              <div className="order-modal-title-box">
                <AlertCircle size={20} className="modal-title-icon" />
                <h3 id="cancel-dialog-title">
                  {needsManualRefund ? "Yêu cầu hoàn tiền đơn hàng" : "Xác nhận hủy đơn hàng"}
                </h3>
              </div>
              <button
                type="button"
                className="order-modal-close"
                onClick={() => {
                  setShowCancelModal(null);
                  setCancelReason("");
                }}
                aria-label="Đóng cửa sổ"
              >
                <X size={18} />
              </button>
            </div>

            <div className="order-modal-body">
              <p className="order-modal-desc">
                {needsManualRefund
                  ? "Đơn hàng đã được thanh toán trực tuyến qua PayOS. Vui lòng cung cấp lý do hủy và thông tin tài khoản ngân hàng thụ hưởng để Admin xử lý hoàn tiền."
                  : "Vui lòng cho biết lý do bạn muốn hủy đơn hàng này:"}
              </p>

              <div className="form-group">
                <label htmlFor="cancel-reason">Lý do hủy đơn *</label>
                <textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do hủy đơn hàng..."
                  rows={3}
                  className="modal-textarea"
                />
              </div>

              {needsManualRefund && (
                <div className="refund-bank-section">
                  <div className="refund-section-title">
                    <h4>Thông tin tài khoản nhận tiền hoàn</h4>
                    <span>Admin sẽ chuyển khoản hoàn tiền theo thông tin này</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="bank-name">Tên ngân hàng *</label>
                    <input
                      id="bank-name"
                      required
                      placeholder="VD: Vietcombank, MB Bank, Techcombank..."
                      value={refundBank.bankName}
                      onChange={(e) =>
                        setRefundBank((curr) => ({ ...curr, bankName: e.target.value }))
                      }
                      className="modal-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="account-number">Số tài khoản *</label>
                    <input
                      id="account-number"
                      required
                      inputMode="numeric"
                      placeholder="Nhập số tài khoản ngân hàng"
                      value={refundBank.accountNumber}
                      onChange={(e) =>
                        setRefundBank((curr) => ({ ...curr, accountNumber: e.target.value }))
                      }
                      className="modal-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="account-holder">Tên chủ tài khoản (in hoa không dấu) *</label>
                    <input
                      id="account-holder"
                      required
                      placeholder="VD: NGUYEN VAN A"
                      value={refundBank.accountHolder}
                      onChange={(e) =>
                        setRefundBank((curr) => ({ ...curr, accountHolder: e.target.value }))
                      }
                      className="modal-input"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="order-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(null);
                  setCancelReason("");
                  setRefundBank({ bankName: "", accountNumber: "", accountHolder: "" });
                }}
                className="btn-modal-back"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                className="btn-modal-confirm"
                disabled={
                  !cancelReason.trim() ||
                  (needsManualRefund &&
                    Object.values(refundBank).some((val) => !val.trim()))
                }
              >
                {needsManualRefund ? "Gửi yêu cầu hoàn tiền" : "Xác nhận hủy đơn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrders;
