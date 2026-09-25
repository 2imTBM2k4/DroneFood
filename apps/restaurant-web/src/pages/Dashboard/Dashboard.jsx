import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ClipboardList,
  DollarSign,
  Clock,
  UtensilsCrossed,
  ArrowRight,
} from "lucide-react";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/AuthContext";
import { ErrorState } from "../../../../shared/components/StateBlock";
import "./Dashboard.css";
import { formatVND } from "../../../../shared/utils/money";

const STATUS_LABELS = {
  pending: "Pending",
  preparing: "Preparing",
  delivering: "Delivering",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const isToday = (value) => {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

/**
 * Merchant home: today's trading at a glance, then the orders that still need
 * the kitchen's attention. Everything is derived from the orders the API
 * already scopes to this restaurant — no new endpoints.
 */
const Dashboard = ({ url }) => {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [menuCount, setMenuCount] = useState(null);
  const [restaurantName, setRestaurantName] = useState("");
  // Trading switch: closed hides the restaurant from customers and refuses
  // new orders, but never affects the owner's own access.
  const [isOpen, setIsOpen] = useState(true);
  const [savingOpen, setSavingOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const [orderRes, foodRes, restRes] = await Promise.all([
        axios.get(`${url}/api/order/list`, { headers: { token } }),
        axios.get(`${url}/api/food/list`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${url}/api/restaurant/list`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!orderRes.data.success) {
        throw new Error(orderRes.data.message || "Could not load orders");
      }

      setOrders(
        (orderRes.data.data || []).map((o) => ({
          ...o,
          orderStatus: (o.orderStatus || "pending").toLowerCase(),
        }))
      );
      if (foodRes.data.success) setMenuCount((foodRes.data.data || []).length);

      // The user object only carries the id, so look the name up for the header.
      if (restRes.data.success && user?.restaurantId) {
        const mine = (restRes.data.data || []).find(
          (r) => String(r._id) === String(user.restaurantId)
        );
        if (mine) {
          setRestaurantName(mine.name);
          setIsOpen(mine.isOpen !== false);
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Could not load dashboard"
      );
    } finally {
      setLoading(false);
    }
  }, [url, user?.restaurantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const todays = orders.filter((o) => isToday(o.createdAt));
    const earning = (list) =>
      list
        .filter((o) => o.orderStatus !== "cancelled")
        .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    const byStatus = orders.reduce((acc, o) => {
      acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
      return acc;
    }, {});

    return {
      todayOrders: todays.length,
      todayRevenue: earning(todays),
      needsAction: orders.filter((o) =>
        ["pending", "preparing"].includes(o.orderStatus)
      ).length,
      byStatus,
    };
  }, [orders]);

  const toggleOpen = async () => {
    const token = localStorage.getItem("token");
    if (!token || savingOpen || !user?.restaurantId) return;

    const next = !isOpen;
    setSavingOpen(true);
    try {
      const res = await axios.patch(
        `${url}/api/restaurant/${user.restaurantId}/open-state`,
        { isOpen: next },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setIsOpen(next);
        toast.success(res.data.message);
      } else {
        toast.error(res.data.message || "Could not change status");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Could not change status"
      );
    } finally {
      setSavingOpen(false);
    }
  };

  const recent = orders
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (error) {
    return (
      <div className="dashboard">
        <ErrorState
          title="Could not load dashboard"
          description={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dash-head">
        <div>
          <p className="dash-eyebrow">Dashboard</p>
          <h1 className="dash-title">
            {restaurantName || user?.name || "Your restaurant"}
          </h1>
        </div>
        <div className="dash-head-actions">
          <div className={`dash-open-switch ${isOpen ? "is-open" : "is-closed"}`}>
            <span className="dash-open-label">
              {isOpen ? "Open for orders" : "Closed"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isOpen}
              aria-label="Toggle whether the restaurant is open"
              className="dash-open-track"
              onClick={toggleOpen}
              disabled={savingOpen}
            >
              <span className="dash-open-thumb" />
            </button>
          </div>
          <Link to="/orders" className="dash-head-link">
            Manage orders
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {!isOpen && (
        <p className="dash-closed-note">
          Your restaurant is closed. Customers can't see it or place orders —
          flip the switch above when you're ready to trade again.
        </p>
      )}

      <section className="dash-stats">
        <StatCard
          icon={ClipboardList}
          label="Orders today"
          value={loading ? "—" : stats.todayOrders}
        />
        <StatCard
          icon={DollarSign}
          label="Revenue today"
          value={loading ? "—" : formatVND(stats.todayRevenue)}
        />
        <StatCard
          icon={Clock}
          label="Needs action"
          value={loading ? "—" : stats.needsAction}
          highlight={!loading && stats.needsAction > 0}
        />
        <StatCard
          icon={UtensilsCrossed}
          label="Menu items"
          value={loading || menuCount === null ? "—" : menuCount}
        />
      </section>

      <section className="dash-panel">
        <div className="dash-panel-head">
          <h2>Order status</h2>
        </div>
        <div className="dash-status-row">
          {Object.keys(STATUS_LABELS).map((key) => (
            <div className="dash-status" key={key}>
              <span className={`dash-status-dot status-${key}`} />
              <span className="dash-status-label">{STATUS_LABELS[key]}</span>
              <span className="dash-status-count">
                {loading ? "—" : stats.byStatus[key] || 0}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="dash-panel">
        <div className="dash-panel-head">
          <h2>Recent orders</h2>
          <Link to="/orders" className="dash-panel-link">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="dash-recent-empty">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="dash-recent-empty">
            No orders yet. They'll appear here as soon as customers order.
          </div>
        ) : (
          <ul className="dash-recent">
            {recent.map((order) => (
              <li className="dash-recent-item" key={order._id}>
                <div className="dash-recent-main">
                  <p className="dash-recent-name">
                    {order.shippingAddress?.fullName || "Customer"}
                  </p>
                  <p className="dash-recent-meta">
                    {(order.orderItems || []).length} item
                    {(order.orderItems || []).length === 1 ? "" : "s"} ·{" "}
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className={`dash-pill status-${order.orderStatus}`}>
                  {STATUS_LABELS[order.orderStatus] || order.orderStatus}
                </span>
                <span className="dash-recent-total">
                  {formatVND(order.totalPrice)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, highlight }) => (
  <article className={`dash-stat ${highlight ? "is-alert" : ""}`}>
    <span className="dash-stat-icon">
      <Icon size={18} />
    </span>
    <div>
      <p className="dash-stat-label">{label}</p>
      <p className="dash-stat-value">{value}</p>
    </div>
  </article>
);

export default Dashboard;
