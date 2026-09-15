import { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Bike, Navigation, ChevronRight } from "lucide-react";
import { StoreContext } from "../../context/StoreContext";
import "./ActiveOrderBar.css";

const ACTIVE_STATUSES = ["pending_payment", "pending", "preparing", "delivering"];

const orderStatusLabel = {
  pending_payment: "Chờ thanh toán",
  pending: "Đã đặt",
  preparing: "Đang chuẩn bị",
  delivering: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  refund_pending: "Chờ hoàn tiền",
};

const ActiveOrderBar = () => {
  const { url, token } = useContext(StoreContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);

  const load = useCallback(async () => {
    if (!token) {
      setOrder(null);
      return;
    }
    try {
      const response = await axios.get(`${url}/api/order/userorders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const orders = response.data.data || [];
      // Chỉ lấy đơn hàng đang xử lý (không lấy đơn đã giao 'delivered' hoặc đã hủy 'cancelled')
      const activeOrder = orders.find((o) => ACTIVE_STATUSES.includes(o.orderStatus));
      setOrder(activeOrder || null);
    } catch {
      setOrder(null);
    }
  }, [token, url]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    const onFocus = () => load();
    const onOrderUpdated = () => load();

    window.addEventListener("focus", onFocus);
    window.addEventListener("order-updated", onOrderUpdated);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("order-updated", onOrderUpdated);
    };
  }, [load, location.pathname]);

  const isOrderActive = order && ACTIVE_STATUSES.includes(order.orderStatus);
  const hidden = !isOrderActive || location.pathname === `/myorders/${order?._id}`;

  if (!order || !isOrderActive) {
    return <aside className="active-order-bar" aria-hidden="true" />;
  }

  const isDrone = order.deliveryMethod === "drone";
  const statusLabel = orderStatusLabel[order.orderStatus] || "Đơn hàng";

  return (
    <aside
      className={`active-order-bar ${hidden ? "" : "visible"}`}
      aria-hidden={hidden}
    >
      <div>
        <span className="active-order-icon">
          {isDrone ? <Navigation size={18} /> : <Bike size={18} />}
        </span>
        <span>
          <strong>Đơn hàng · {statusLabel}</strong>
          <small>#{order._id?.slice(-8).toUpperCase()}</small>
        </span>
      </div>
      <button
        type="button"
        tabIndex={hidden ? -1 : 0}
        onClick={() => navigate(`/myorders/${order._id}`)}
      >
        Xem đơn hàng <ChevronRight size={16} />
      </button>
    </aside>
  );
};

export default ActiveOrderBar;
