import { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Bike, ChevronRight } from "lucide-react";
import { StoreContext } from "../../context/StoreContext";
import "./ActiveOrderBar.css";

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
  const { url, token } = useContext(StoreContext); const location = useLocation(); const navigate = useNavigate(); const [order, setOrder] = useState(null);
  const load = useCallback(async () => { if (!token) { setOrder(null); return; } try { const response = await axios.get(`${url}/api/order/userorders`, { headers: { Authorization: `Bearer ${token}` } }); setOrder((response.data.data || [])[0] || null); } catch { setOrder(null); } }, [token, url]);
  useEffect(() => { load(); const timer = window.setInterval(load, 20000); return () => window.clearInterval(timer); }, [load]);
  const hidden = !order || location.pathname === `/myorders/${order._id}`;
  const statusLabel = orderStatusLabel[order?.orderStatus] || "Đơn hàng";
  return <aside className={`active-order-bar ${hidden ? "" : "visible"}`} aria-hidden={hidden}><div><span className="active-order-icon"><Bike size={18} /></span><span><strong>Đơn hàng · {statusLabel}</strong><small>#{order?._id?.slice(-8).toUpperCase()}</small></span></div><button type="button" tabIndex={hidden ? -1 : 0} onClick={() => navigate(`/myorders/${order._id}`)}>Xem đơn hàng <ChevronRight size={16} /></button></aside>;
};
export default ActiveOrderBar;
