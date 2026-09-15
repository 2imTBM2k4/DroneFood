import { useCallback, useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import {
  Bike,
  Clock3,
  MapPin,
  PackageCheck,
  Store,
  Navigation,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Phone,
  ShieldCheck,
  UtensilsCrossed,
  Receipt,
  CreditCard,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { MapContainer, Marker, TileLayer, Popup } from "react-leaflet";
import L from "leaflet";
import { toast } from "react-toastify";
import "leaflet/dist/leaflet.css";
import { StoreContext } from "../../context/StoreContext";
import DroneDelivery from "../../components/DroneDelivery/DroneDelivery";
import { formatVND } from "../../../../shared/utils/money";
import "./OrderDetail.css";

// Setup Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const storeMarkerIcon = L.divIcon({
  html: `<div class="map-pin-badge store-badge"><span>🏪</span></div>`,
  className: "custom-map-icon",
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

const dropoffMarkerIcon = L.divIcon({
  html: `<div class="map-pin-badge dropoff-badge"><span>📍</span></div>`,
  className: "custom-map-icon",
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

const shipperMarkerIcon = L.divIcon({
  html: `<div class="map-pin-badge shipper-badge"><span>🛵</span></div>`,
  className: "custom-map-icon",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
});

const STATUS_TEXT = {
  pending_payment: "Chờ thanh toán",
  pending: "Đã đặt đơn",
  preparing: "Nhà hàng đang chuẩn bị",
  delivering: "Đang giao hàng",
  delivered: "Giao thành công",
  cancelled: "Đã hủy",
  refund_pending: "Chờ hoàn tiền",
};

const STATUS_CLASSES = {
  pending_payment: "status-pending",
  pending: "status-pending",
  preparing: "status-preparing",
  delivering: "status-delivering",
  delivered: "status-delivered",
  cancelled: "status-cancelled",
  refund_pending: "status-refund-pending",
};

const OrderDetail = () => {
  const { id } = useParams();
  const { url, token } = useContext(StoreContext);

  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [droneReadyForConfirmation, setDroneReadyForConfirmation] = useState(false);
  const [confirmingDrone, setConfirmingDrone] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await axios.get(`${url}/api/order/${id}/customer-detail`, {
        headers: { token },
      });
      if (response.data.data) {
        setOrder(response.data.data);
        setError("");
      } else {
        throw new Error("Không tìm thấy thông tin đơn hàng.");
      }
    } catch (err) {
      console.error("Load order detail error:", err);
      setError(err.response?.data?.message || "Không thể tải chi tiết đơn hàng.");
    }
  }, [id, token, url]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (order?.orderStatus !== "delivering") return undefined;
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [load, order?.orderStatus]);

  const confirmDroneDelivery = async () => {
    if (!order || confirmingDrone) return;
    setConfirmingDrone(true);
    try {
      const response = await axios.post(
        `${url}/api/drone/confirm-delivery`,
        { orderId: order._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.data.success) {
        throw new Error(response.data.message || "Không thể xác nhận giao hàng.");
      }
      toast.success("Đã xác nhận nhận hàng thành công.");
      setDroneReadyForConfirmation(false);
      await load();
    } catch (err) {
      try {
        await axios.post(
          `${url}/api/order/status`,
          {
            orderId: order._id,
            status: "delivered",
            isPaid: true,
            paidAt: new Date().toISOString(),
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Đã xác nhận nhận hàng thành công.");
        setDroneReadyForConfirmation(false);
        await load();
      } catch (fallbackErr) {
        toast.error(err.response?.data?.message || err.message || "Không thể xác nhận giao hàng.");
      }
    } finally {
      setConfirmingDrone(false);
    }
  };

  const retryPayosPayment = async () => {
    if (!order || retryingPayment) return;
    setRetryingPayment(true);
    try {
      const response = await axios.post(
        `${url}/api/order/retry-payos`,
        { orderId: order._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.data.success || !response.data.checkoutUrl) {
        throw new Error(response.data.message || "Không thể tạo lại liên kết thanh toán");
      }
      window.location.assign(response.data.checkoutUrl);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Không thể tạo lại liên kết thanh toán");
      setRetryingPayment(false);
    }
  };

  const [cancellingOrder, setCancellingOrder] = useState(false);
  const handleCancelOrder = async () => {
    if (!order || cancellingOrder) return;
    if (order.paymentMethod === "PAYOS" && order.isPaid) {
      toast.info(
        "Đơn hàng đã thanh toán qua PayOS. Vui lòng chuyển sang trang Danh sách đơn hàng để gửi yêu cầu hoàn tiền kèm số tài khoản ngân hàng."
      );
      return;
    }
    const reason = window.prompt("Nhập lý do hủy đơn hàng:", "Đổi ý không mua nữa");
    if (!reason || !reason.trim()) return;
    setCancellingOrder(true);
    try {
      const response = await axios.post(
        `${url}/api/order/status`,
        {
          orderId: order._id,
          status: "cancelled",
          reason: reason.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success("Đã hủy đơn hàng thành công.");
        await load();
      } else {
        toast.error(response.data.message || "Hủy đơn thất bại");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Hủy đơn thất bại");
    } finally {
      setCancellingOrder(false);
    }
  };

  const getItemImage = (item) => {
    const raw = item.product?.image || item.image;
    if (!raw) return null;
    return raw.startsWith("http") ? raw : `${url}/images/${raw}`;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (error) {
    return (
      <main className="order-detail-page">
        <div className="order-detail-container">
          <Link to="/myorders" className="order-detail-back-btn">
            <ArrowLeft size={16} />
            <span>Quay lại danh sách đơn hàng</span>
          </Link>
          <div className="order-detail-error-card">
            <AlertCircle size={28} />
            <div className="error-card-content">
              <h3>Đã xảy ra lỗi</h3>
              <p>{error}</p>
            </div>
            <button type="button" onClick={load} className="btn-retry">
              Thử lại
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="order-detail-page">
        <div className="order-detail-container">
          <div className="order-detail-skeleton-wrap">
            <div className="skeleton-bar skeleton-header" />
            <div className="order-detail-skeleton-grid">
              <div className="skeleton-bar skeleton-main" />
              <div className="skeleton-bar skeleton-side" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const isShipperTracking =
    order.deliveryMethod === "shipper" &&
    order.orderStatus === "delivering" &&
    (order.shipperAssignmentStatus === "picked_up" || Boolean(order.shipperPickedUpAt));

  const isDroneTracking =
    order.deliveryMethod === "drone" &&
    order.orderStatus === "delivering" &&
    Boolean(order.droneId);

  const pickup = [order.restaurantId?.lat, order.restaurantId?.lng];
  const dropoff = [order.shippingAddress?.lat, order.shippingAddress?.lng];
  const shipper = order.tracking?.location
    ? [order.tracking.location.lat, order.tracking.location.lng]
    : null;
  const center = shipper || dropoff || pickup || [10.7769, 106.7008];

  const orderCode = order._id.slice(-8).toUpperCase();
  const isDrone = order.deliveryMethod === "drone";
  const statusClass = STATUS_CLASSES[order.orderStatus] || "status-default";

  // Build steps for progress stepper
  const isDelivered = order.orderStatus === "delivered";
  const isDelivering = order.orderStatus === "delivering";
  const isPreparing = order.orderStatus === "preparing";
  const isCancelled = order.orderStatus === "cancelled";
  const canRetryPayosPayment =
    order.paymentMethod === "PAYOS" &&
    !order.isPaid &&
    order.orderStatus === "pending_payment";

  return (
    <main className="order-detail-page">
      <div className="order-detail-container">
        {/* Top Navigation & Breadcrumb */}
        <nav className="order-detail-nav">
          <Link to="/myorders" className="order-detail-back-btn">
            <ArrowLeft size={16} />
            <span>Danh sách đơn hàng</span>
          </Link>
          <span className="nav-divider">/</span>
          <span className="nav-current">Chi tiết đơn #{orderCode}</span>
        </nav>

        {/* Master Header Card */}
        <header className="order-detail-header-card">
          <div className="header-card-left">
            <div className="header-title-row">
              <h1>Đơn hàng #{orderCode}</h1>
              <div className={`detail-status-badge ${statusClass}`}>
                {isDelivering && <span className="live-dot" aria-hidden="true" />}
                <span>{STATUS_TEXT[order.orderStatus] || order.orderStatus}</span>
              </div>
            </div>

            <div className="header-meta-row">
              <span className="meta-time">
                <Clock3 size={14} />
                Đặt lúc: {formatDateTime(order.createdAt)}
              </span>
              <span className="meta-dot">·</span>
              <div className={`meta-delivery-type ${isDrone ? "drone" : "shipper"}`}>
                {isDrone ? (
                  <>
                    <Navigation size={14} className="drone-rotate-icon" />
                    <span>Giao bằng Drone</span>
                  </>
                ) : (
                  <>
                    <Bike size={14} />
                    <span>Giao bằng Shipper</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="header-card-right">
            {canRetryPayosPayment && (
              <button
                type="button"
                className="btn-retry-payos"
                onClick={retryPayosPayment}
                disabled={retryingPayment}
              >
                <RotateCcw size={14} className={retryingPayment ? "spin-icon" : ""} />
                <span>{retryingPayment ? "Đang tạo link…" : "Thanh toán lại"}</span>
              </button>
            )}
            {(order.orderStatus === "pending" || order.orderStatus === "pending_payment") && (
              <button
                type="button"
                className="btn-cancel-detail"
                onClick={handleCancelOrder}
                disabled={cancellingOrder}
              >
                {cancellingOrder ? "Đang hủy…" : "Hủy đơn hàng"}
              </button>
            )}
            <button
              type="button"
              className="btn-refresh-status"
              onClick={load}
              title="Làm mới trạng thái"
            >
              <RotateCcw size={15} />
              <span>Cập nhật</span>
            </button>
          </div>
        </header>

        {/* Two-Column Layout */}
        <div className="order-detail-layout">
          {/* Main Column (Left - 62%) */}
          <div className="order-detail-main-col">
            {/* Live Drone Tracking Card */}
            {isDroneTracking && (
              <section className="detail-card drone-tracking-card" aria-label="Theo dõi Drone">
                <div className="card-header-line">
                  <div className="card-header-icon drone-bg">
                    <Navigation size={18} />
                  </div>
                  <div>
                    <h2>Theo dõi lộ trình Drone</h2>
                    <p>Drone đã nhận món từ nhà hàng. Vui lòng quét mã QR khi Drone đáp xuống để nhận hàng.</p>
                  </div>
                </div>

                <div className="drone-component-embed">
                  <DroneDelivery
                    order={order}
                    onDeliveryComplete={async () => {
                      setDroneReadyForConfirmation(true);
                      await load();
                    }}
                  />
                </div>

                {droneReadyForConfirmation && (
                  <div className="drone-confirm-banner">
                    <div className="confirm-banner-text">
                      <Sparkles size={18} className="sparkle-icon" />
                      <div>
                        <strong>Drone đã hoàn tất hạ cánh an toàn</strong>
                        <p>Vui lòng kiểm tra thức ăn và bấm xác nhận để hoàn tất đơn hàng.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-confirm-delivery"
                      onClick={confirmDroneDelivery}
                      disabled={confirmingDrone}
                    >
                      {confirmingDrone ? "Đang xử lý…" : "Xác nhận đã nhận hàng"}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Live Shipper Tracking Card */}
            {isShipperTracking && (
              <section className="detail-card shipper-tracking-card" aria-label="Theo dõi Shipper">
                <div className="card-header-line">
                  <div className="card-header-icon shipper-bg">
                    <Bike size={18} />
                  </div>
                  <div>
                    <h2>Theo dõi tài xế trực tiếp</h2>
                    <p>Tài xế đã lấy món từ nhà hàng. Tọa độ GPS được tự động cập nhật mỗi 10 giây.</p>
                  </div>
                </div>

                {center && (
                  <div className="order-detail-map-frame">
                    <MapContainer center={center} zoom={14} scrollWheelZoom={false} className="leaflet-map-view">
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                      />
                      {pickup[0] && (
                        <Marker position={pickup} icon={storeMarkerIcon}>
                          <Popup>{order.restaurantId?.name || "Nhà hàng"}</Popup>
                        </Marker>
                      )}
                      {dropoff[0] && (
                        <Marker position={dropoff} icon={dropoffMarkerIcon}>
                          <Popup>Điểm nhận hàng: {order.shippingAddress?.address}</Popup>
                        </Marker>
                      )}
                      {shipper && (
                        <Marker position={shipper} icon={shipperMarkerIcon}>
                          <Popup>Tài xế: {order.shipperId?.name || "Shipper"}</Popup>
                        </Marker>
                      )}
                    </MapContainer>
                  </div>
                )}

                {!shipper && (
                  <div className="shipper-wait-notice">
                    <Clock3 size={15} />
                    <span>Đang kết nối tín hiệu GPS từ thiết bị của tài xế...</span>
                  </div>
                )}
              </section>
            )}

            {/* Timeline Progress Card */}
            <section className="detail-card timeline-card" aria-label="Tiến trình đơn hàng">
              <div className="card-header-line">
                <div className="card-header-icon timeline-bg">
                  <Clock3 size={18} />
                </div>
                <div>
                  <h2>Tiến trình đơn hàng</h2>
                  <p>Cập nhật trạng thái từng giai đoạn từ lúc đặt đơn đến khi nhận hàng.</p>
                </div>
              </div>

              <div className="timeline-stepper">
                {/* Step 1: Placed */}
                <div className="timeline-step done">
                  <div className="step-indicator">
                    <div className="step-circle">
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="step-line" />
                  </div>
                  <div className="step-content">
                    <div className="step-title-line">
                      <h4>Đặt đơn thành công</h4>
                      <span className="step-time">{formatDateTime(order.createdAt)}</span>
                    </div>
                    <p className="step-desc">Đơn hàng đã được ghi nhận trên hệ thống DroneFood.</p>
                  </div>
                </div>

                {/* Step 2: Preparing */}
                <div
                  className={`timeline-step ${
                    isDelivering || isDelivered ? "done" : isPreparing ? "current" : isCancelled ? "" : "pending"
                  }`}
                >
                  <div className="step-indicator">
                    <div className="step-circle">
                      {isDelivering || isDelivered ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <Store size={15} />
                      )}
                    </div>
                    <div className="step-line" />
                  </div>
                  <div className="step-content">
                    <div className="step-title-line">
                      <h4>Nhà hàng tiếp nhận & chuẩn bị</h4>
                      {order.shipperAcceptedAt && (
                        <span className="step-time">{formatDateTime(order.shipperAcceptedAt)}</span>
                      )}
                    </div>
                    <p className="step-desc">
                      {order.restaurantId?.name || "Nhà hàng"} đang chuẩn bị các món ăn nóng hổi.
                    </p>
                  </div>
                </div>

                {/* Step 3: Delivering */}
                <div
                  className={`timeline-step ${
                    isDelivered ? "done" : isDelivering ? "current" : ""
                  }`}
                >
                  <div className="step-indicator">
                    <div className="step-circle">
                      {isDelivered ? (
                        <CheckCircle2 size={16} />
                      ) : isDrone ? (
                        <Navigation size={15} />
                      ) : (
                        <Bike size={15} />
                      )}
                    </div>
                    <div className="step-line" />
                  </div>
                  <div className="step-content">
                    <div className="step-title-line">
                      <h4>{isDrone ? "Drone đang vận chuyển" : "Tài xế đang giao hàng"}</h4>
                      {order.shipperPickedUpAt && (
                        <span className="step-time">{formatDateTime(order.shipperPickedUpAt)}</span>
                      )}
                    </div>
                    <p className="step-desc">
                      {isDrone
                        ? "Drone đang bay theo hành lang không lưu về trạm đích."
                        : order.shipperId?.name
                        ? `Tài xế ${order.shipperId.name} đang trên đường đến giao cho bạn.`
                        : "Đang phân phối tài xế giao hàng."}
                    </p>
                  </div>
                </div>

                {/* Step 4: Delivered */}
                <div className={`timeline-step ${isDelivered ? "done" : ""}`}>
                  <div className="step-indicator">
                    <div className="step-circle">
                      <ShieldCheck size={16} />
                    </div>
                  </div>
                  <div className="step-content">
                    <div className="step-title-line">
                      <h4>Giao hàng thành công</h4>
                      {order.paidAt && (
                        <span className="step-time">{formatDateTime(order.paidAt)}</span>
                      )}
                    </div>
                    <p className="step-desc">
                      {isDelivered
                        ? "Đơn hàng đã được bàn giao thành công. Chúc bạn ngon miệng!"
                        : "Khách hàng nhận món và hoàn tất đơn hàng."}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Order Items Detail Card */}
            <section className="detail-card items-detail-card" aria-label="Món ăn đã đặt">
              <div className="card-header-line">
                <div className="card-header-icon items-bg">
                  <PackageCheck size={18} />
                </div>
                <div className="header-with-count">
                  <div>
                    <h2>Món ăn đã đặt</h2>
                    <p>Chi tiết các món ăn, tùy chọn và ghi chú đầu bếp.</p>
                  </div>
                  <span className="items-count-badge">
                    {order.orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0} món
                  </span>
                </div>
              </div>

              <div className="detail-items-table">
                {order.orderItems?.map((item, index) => {
                  const imgSrc = getItemImage(item);
                  const itemTotal = item.price * item.quantity;
                  return (
                    <div key={`${item.product || item.name}-${index}`} className="detail-item-row">
                      <div className="detail-item-thumb">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={item.name}
                            onError={(e) => {
                              e.target.style.display = "none";
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className="detail-item-thumb-fallback"
                          style={{ display: imgSrc ? "none" : "flex" }}
                        >
                          <UtensilsCrossed size={18} />
                        </div>
                      </div>

                      <div className="detail-item-content">
                        <div className="detail-item-name-row">
                          <h4 className="detail-item-name">{item.name}</h4>
                          <span className="detail-item-qty-tag">x{item.quantity}</span>
                        </div>

                        {item.selectedOptions?.length > 0 && (
                          <div className="detail-item-options">
                            {item.selectedOptions.map((opt) => opt.optionName).join(" · ")}
                          </div>
                        )}

                        {item.note && (
                          <div className="detail-item-note">
                            Ghi chú: “{item.note}”
                          </div>
                        )}

                        <div className="detail-item-unit-price">
                          Đơn giá: {formatVND(item.price)}
                        </div>
                      </div>

                      <div className="detail-item-total-col">
                        {formatVND(itemTotal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Sticky Sidebar Column (Right - 38%) */}
          <aside className="order-detail-side-col">
            {/* Route & Delivery Info Card */}
            <section className="detail-card route-info-card" aria-label="Thông tin lộ trình">
              <div className="side-card-title">
                <MapPin size={16} />
                <h3>Lộ trình giao hàng</h3>
              </div>

              <div className="route-endpoints">
                {/* Restaurant */}
                <div className="route-endpoint">
                  <div className="endpoint-icon-box store-color">
                    <Store size={16} />
                  </div>
                  <div className="endpoint-details">
                    <span className="endpoint-label">Nhà hàng chuẩn bị</span>
                    <strong className="endpoint-name">{order.restaurantId?.name || "Nhà hàng đối tác"}</strong>
                    <p className="endpoint-addr">{order.restaurantId?.address || "Địa chỉ nhà hàng"}</p>
                  </div>
                </div>

                <div className="route-connector-line" />

                {/* Dropoff */}
                <div className="route-endpoint">
                  <div className="endpoint-icon-box dropoff-color">
                    <MapPin size={16} />
                  </div>
                  <div className="endpoint-details">
                    <span className="endpoint-label">Địa chỉ nhận hàng</span>
                    <strong className="endpoint-name">
                      {order.shippingAddress?.fullName} · {order.shippingAddress?.phone}
                    </strong>
                    <p className="endpoint-addr">
                      {[
                        order.shippingAddress?.address,
                        order.shippingAddress?.city,
                        order.shippingAddress?.state,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Shipper info (if available) */}
              {order.deliveryMethod === "shipper" && (
                <div className="assigned-delivery-box">
                  <div className="assigned-icon">
                    <Bike size={16} />
                  </div>
                  <div className="assigned-meta">
                    <span className="assigned-label">Tài xế giao nhận</span>
                    <strong className="assigned-name">
                      {order.shipperId?.name || "Đang kết nối tài xế..."}
                    </strong>
                    {order.shipperId?.phone && (
                      <a href={`tel:${order.shipperId.phone}`} className="assigned-phone-link">
                        <Phone size={13} />
                        <span>{order.shipperId.phone}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Drone info (if drone delivery) */}
              {order.deliveryMethod === "drone" && (
                <div className="assigned-delivery-box drone-box">
                  <div className="assigned-icon drone-color">
                    <Navigation size={16} />
                  </div>
                  <div className="assigned-meta">
                    <span className="assigned-label">Phương tiện không người lái</span>
                    <strong className="assigned-name">
                      DroneFood Autonomous Airway
                    </strong>
                    {order.droneId && (
                      <span className="drone-id-tag">Mã Drone: #{order.droneId}</span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Payment & Price Summary Card */}
            <section className="detail-card payment-summary-card" aria-label="Tóm tắt thanh toán">
              <div className="side-card-title">
                <Receipt size={16} />
                <h3>Chi tiết thanh toán</h3>
              </div>

              <div className="summary-price-breakdown">
                <div className="summary-price-row">
                  <span>Tạm tính tiền món</span>
                  <strong>{formatVND(order.itemsPrice)}</strong>
                </div>

                <div className="summary-price-row">
                  <span>Phí giao hàng</span>
                  <strong>{formatVND(order.shippingPrice)}</strong>
                </div>

                {order.serviceFee > 0 && (
                  <div className="summary-price-row">
                    <span>Phí dịch vụ</span>
                    <strong>{formatVND(order.serviceFee)}</strong>
                  </div>
                )}

                {order.discountAmount > 0 && (
                  <div className="summary-price-row discount-row">
                    <span>Voucher khuyến mãi</span>
                    <strong>-{formatVND(order.discountAmount)}</strong>
                  </div>
                )}

                <div className="summary-total-divider" />

                <div className="summary-total-row">
                  <div className="total-title-group">
                    <span className="total-title">Tổng thanh toán</span>
                    <small className="vat-note">(Đã bao gồm thuế & phí)</small>
                  </div>
                  <strong className="total-val">{formatVND(order.totalPrice)}</strong>
                </div>
              </div>

              {/* Payment Method Details */}
              <div className="summary-payment-method">
                <div className="method-label-group">
                  <CreditCard size={15} />
                  <span>Phương thức thanh toán</span>
                </div>
                <div className="method-value-group">
                  <span className="method-badge">
                    {order.paymentMethod === "COD"
                      ? "Tiền mặt khi nhận hàng (COD)"
                      : order.paymentMethod === "PAYOS"
                      ? "PayOS (Chuyển khoản QR)"
                      : "VNPay"}
                  </span>
                  <span className={`paid-pill ${order.isPaid ? "paid" : "unpaid"}`}>
                    {order.isPaid ? "Đã thanh toán" : "Chưa thanh toán"}
                  </span>
                </div>
                {canRetryPayosPayment && (
                  <div className="retry-payment-callout" role="status">
                    <div>
                      <strong>Đơn hàng đang chờ thanh toán</strong>
                      <p>Liên kết trước có thể đã hết hạn hoặc bị hủy. Bạn có thể tạo liên kết PayOS mới cho đơn này.</p>
                    </div>
                    <button
                      type="button"
                      className="btn-retry-payment-detail"
                      onClick={retryPayosPayment}
                      disabled={retryingPayment}
                      aria-busy={retryingPayment}
                    >
                      <RotateCcw size={15} aria-hidden="true" className={retryingPayment ? "spin-icon" : ""} />
                      <span>{retryingPayment ? "Đang tạo link…" : "Thanh toán lại"}</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default OrderDetail;
