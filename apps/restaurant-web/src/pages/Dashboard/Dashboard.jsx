import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ClipboardList,
  DollarSign,
  Clock,
  UtensilsCrossed,
  ArrowRight,
  Building2,
  Users,
  Store,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import { AuthContext } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { ErrorState } from "@drone-food/web-ui/components/StateBlock";
import { ConfirmModal } from "@drone-food/web-ui/components/ConfirmModal";
import "./Dashboard.css";
import { formatVND } from "@drone-food/web-ui/utils/money";

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
 * Merchant & Brand Owner home:
 * - Brand Owners with "all branches" view get a full Brand Dashboard
 *   showing chain KPIs, branch comparison table, manager status, and chain recent orders.
 * - Single branch view (or branch managers) get localized branch controls & metrics.
 */
const Dashboard = ({ url }) => {
  const { user } = useContext(AuthContext);
  const {
    branches,
    merchant,
    selectedBranchId,
    currentBranch,
    isAllBranches,
    refreshBranches,
    setSelectedBranchId,
  } = useBranch();
  const [orders, setOrders] = useState([]);
  const [menuCount, setMenuCount] = useState(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [savingOpen, setSavingOpen] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isBrandOwner = user?.role === "merchant_owner" || user?.role === "admin";
  const showBrandDashboard = isBrandOwner;

  useEffect(() => {
    if (currentBranch) {
      setIsOpen(currentBranch.isOpen !== false);
    }
  }, [currentBranch]);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const orderParams = selectedBranchId && selectedBranchId !== "all"
        ? { branchId: selectedBranchId }
        : {};
      const [orderRes, foodRes, restRes] = await Promise.all([
        axios.get(`${url}/api/order/list`, { headers: { token }, params: orderParams }),
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

      if (restRes.data.success && user?.restaurantId) {
        const mine = (restRes.data.data || []).find(
          (r) => String(r._id) === String(user.restaurantId)
        );
        if (mine) {
          setRestaurantName(mine.name);
          if (!currentBranch) {
            setIsOpen(mine.isOpen !== false);
          }
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Could not load dashboard"
      );
    } finally {
      setLoading(false);
    }
  }, [url, user?.restaurantId, selectedBranchId, currentBranch]);

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

  // Performance calculations per branch for Brand Dashboard
  const branchPerformance = useMemo(() => {
    const todays = orders.filter((o) => isToday(o.createdAt));
    const totalTodayRevenue = stats.todayRevenue;

    return branches.map((branch) => {
      const branchOrders = orders.filter((o) => {
        const oBranchId = typeof o.branchId === "object" ? o.branchId?._id : o.branchId;
        return String(oBranchId) === String(branch._id);
      });
      const branchTodayOrders = branchOrders.filter((o) => isToday(o.createdAt));
      const branchRevenue = branchTodayOrders
        .filter((o) => o.orderStatus !== "cancelled")
        .reduce((sum, o) => sum + (o.totalPrice || 0), 0);
      const manager =
        Array.isArray(branch.managerUserIds) && branch.managerUserIds.length > 0
          ? branch.managerUserIds[0]
          : null;
      const sharePercent =
        totalTodayRevenue > 0
          ? Math.round((branchRevenue / totalTodayRevenue) * 100)
          : 0;

      return {
        branch,
        manager,
        todayOrdersCount: branchTodayOrders.length,
        todayRevenue: branchRevenue,
        sharePercent,
        activeOrdersCount: branchOrders.filter((o) =>
          ["pending", "preparing", "delivering"].includes(o.orderStatus)
        ).length,
      };
    });
  }, [branches, orders, stats.todayRevenue]);

  // Sắp xếp danh sách chi nhánh theo doanh thu giảm dần (Top Doanh thu)
  const topBranchesByRevenue = useMemo(() => {
    return [...branchPerformance].sort((a, b) => {
      if (b.todayRevenue !== a.todayRevenue) {
        return b.todayRevenue - a.todayRevenue;
      }
      if (b.todayOrdersCount !== a.todayOrdersCount) {
        return b.todayOrdersCount - a.todayOrdersCount;
      }
      return (b.activeOrdersCount || 0) - (a.activeOrdersCount || 0);
    });
  }, [branchPerformance]);

  const openBranchesCount = useMemo(() => {
    return branches.filter((b) => b.isOpen !== false).length;
  }, [branches]);

  const assignedManagersCount = useMemo(() => {
    return branches.filter(
      (b) => Array.isArray(b.managerUserIds) && b.managerUserIds.length > 0
    ).length;
  }, [branches]);

  const doToggleOpen = async (targetState) => {
    const token = localStorage.getItem("token");
    if (!token || savingOpen) return;

    setSavingOpen(true);
    try {
      if (currentBranch?._id) {
        const res = await axios.patch(
          `${url}/api/branch/${currentBranch._id}/open-state`,
          { isOpen: targetState },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data?.success) {
          setIsOpen(targetState);
          notificationService.success(
            targetState ? "Chi nhánh đã mở bán" : "Chi nhánh đã tạm đóng",
            currentBranch.name
          );
          refreshBranches();
        }
      } else if (user?.restaurantId) {
        const res = await axios.patch(
          `${url}/api/restaurant/${user.restaurantId}/open-state`,
          { isOpen: targetState },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data?.success) {
          setIsOpen(targetState);
          notificationService.success(
            res.data.message || (targetState ? "Cửa hàng đã mở bán" : "Cửa hàng đã tạm đóng")
          );
        }
      }
    } catch (err) {
      notificationService.error(
        "Không thể đổi trạng thái hoạt động",
        err.response?.data?.message || "Lỗi máy chủ khi cập nhật trạng thái hoạt động."
      );
    } finally {
      setSavingOpen(false);
    }
  };

  const handleToggleClick = () => {
    if (isOpen) {
      setShowConfirmClose(true);
    } else {
      doToggleOpen(true);
    }
  };

  const recent = orders
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

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

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. BRAND OWNER DASHBOARD VIEW (Khi xem tất cả chi nhánh)
  // ─────────────────────────────────────────────────────────────────────────────
  if (showBrandDashboard) {
    return (
      <div className="dashboard brand-dashboard">
        {/* Header Thương hiệu */}
        <header className="dash-head brand-dash-head">
          <div>
            <div className="brand-header-meta">
              <span className="brand-eyebrow-badge">
                <ShieldCheck size={12} /> Bảng điều khiển chuỗi thương hiệu
              </span>
              <span className="brand-branches-count">
                {branches.length} Chi nhánh
              </span>
            </div>
            <h1 className="dash-title brand-main-title">
              {merchant?.name || restaurantName || "Thương hiệu của bạn"}
            </h1>
            <p className="brand-subtext">
              Theo dõi hiệu suất kinh doanh toàn chuỗi, tình trạng vận hành và quản lý của từng chi nhánh
            </p>
          </div>

          <div className="dash-head-actions">
            <Link to="/branches" className="dash-head-link brand-quick-link">
              <Building2 size={14} /> Quản lý chi nhánh
            </Link>
            <Link to="/list" className="dash-head-link brand-quick-link">
              <UtensilsCrossed size={14} /> Thực đơn gốc
            </Link>
          </div>
        </header>

        {/* Thẻ thống kê KPI Toàn Chuỗi */}
        <section className="dash-stats brand-kpi-grid">
          <StatCard
            icon={DollarSign}
            label="Doanh thu hôm nay (Toàn chuỗi)"
            value={loading ? "—" : formatVND(stats.todayRevenue)}
            badge="Doanh thu"
          />
          <StatCard
            icon={ClipboardList}
            label="Tổng đơn hàng hôm nay"
            value={loading ? "—" : `${stats.todayOrders} đơn`}
            badge="Đơn mới"
          />
          <StatCard
            icon={Store}
            label="Chi nhánh đang mở"
            value={loading ? "—" : `${openBranchesCount} / ${branches.length}`}
            sublabel={
              openBranchesCount === branches.length
                ? "Tất cả chi nhánh đang mở"
                : `${branches.length - openBranchesCount} chi nhánh đang đóng`
            }
          />
          <StatCard
            icon={Users}
            label="Nhân sự quản lý"
            value={loading ? "—" : `${assignedManagersCount} / ${branches.length}`}
            sublabel={
              assignedManagersCount === branches.length
                ? "Đã có đủ quản lý"
                : `${branches.length - assignedManagersCount} chi nhánh thiếu quản lý`
            }
            highlight={assignedManagersCount < branches.length}
          />
          <StatCard
            icon={Clock}
            label="Đơn cần xử lý ngay"
            value={loading ? "—" : stats.needsAction}
            highlight={!loading && stats.needsAction > 0}
            sublabel="Đang chờ hoặc chuẩn bị"
          />
          <StatCard
            icon={UtensilsCrossed}
            label="Thực đơn món ăn"
            value={loading || menuCount === null ? "—" : `${menuCount} món`}
            sublabel="Thực đơn chính thức"
          />
        </section>

        {/* Bảng xếp hạng Top Chi nhánh theo Doanh thu */}
        <section className="dash-panel brand-branches-panel">
          <div className="dash-panel-head">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <TrendingUp size={20} color="#2563eb" />
                <h2 style={{ margin: 0 }}>Bảng xếp hạng Top Chi nhánh theo Doanh thu</h2>
              </div>
              <p className="panel-sub-desc">
                Xếp hạng đóng góp doanh thu của từng chi nhánh trong chuỗi hôm nay (sắp xếp theo doanh thu cao nhất)
              </p>
            </div>
            <Link to="/branches" className="dash-panel-link">
              Quản lý chi nhánh <ArrowRight size={13} style={{ display: "inline", verticalAlign: "middle" }} />
            </Link>
          </div>

          {branches.length === 0 ? (
            <div className="dash-recent-empty">
              Chưa có chi nhánh nào được cấu hình cho thương hiệu này.{" "}
              <Link to="/branches">Thêm chi nhánh ngay</Link>.
            </div>
          ) : (
            <div className="brand-table-wrapper">
              <table className="brand-branch-table">
                <thead>
                  <tr>
                    <th style={{ width: "70px", textAlign: "center" }}>Hạng</th>
                    <th>Chi nhánh</th>
                    <th>Quản lý phụ trách</th>
                    <th>Trạng thái mở</th>
                    <th>Giao Drone</th>
                    <th style={{ textAlign: "right" }}>Đơn hôm nay</th>
                    <th style={{ textAlign: "right" }}>Doanh thu hôm nay</th>
                    <th style={{ width: "160px" }}>Tỷ trọng</th>
                  </tr>
                </thead>
                <tbody>
                  {topBranchesByRevenue.map(
                    ({ branch, manager, todayOrdersCount, todayRevenue, sharePercent }, index) => (
                      <tr key={branch._id}>
                        <td style={{ textAlign: "center" }}>
                          <span className={`rank-badge rank-${index + 1}`}>
                            {index === 0
                              ? "🥇 #1"
                              : index === 1
                              ? "🥈 #2"
                              : index === 2
                              ? "🥉 #3"
                              : `#${index + 1}`}
                          </span>
                        </td>

                        <td>
                          <div className="table-branch-name-col">
                            <strong>{branch.name}</strong>
                            <span className="branch-code-badge">{branch.code}</span>
                          </div>
                          <small className="table-branch-address">
                            {branch.address?.text || "Chưa có địa chỉ"}
                          </small>
                        </td>

                        <td>
                          {manager ? (
                            <div className="table-manager-info">
                              <span className="table-manager-name">{manager.name}</span>
                              <span className="table-manager-email">{manager.email}</span>
                            </div>
                          ) : (
                            <div className="table-manager-missing">
                              <span className="tag-unassigned">Chưa có quản lý</span>
                              <Link to="/branches" className="btn-assign-quick">
                                Bổ nhiệm
                              </Link>
                            </div>
                          )}
                        </td>

                        <td>
                          <span
                            className={`branch-pill-status ${
                              branch.isOpen !== false ? "open" : "closed"
                            }`}
                          >
                            <span className="status-dot" />
                            {branch.isOpen !== false ? "Đang mở" : "Tạm đóng"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`drone-badge ${
                              branch.droneDeliveryEnabled ? "enabled" : "disabled"
                            }`}
                          >
                            {branch.droneDeliveryEnabled ? "Đã bật" : "Chưa bật"}
                          </span>
                        </td>

                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                          {todayOrdersCount} đơn
                        </td>

                        <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                          {formatVND(todayRevenue)}
                        </td>

                        <td>
                          <div className="share-bar-container">
                            <div className="share-bar-track">
                              <div
                                className="share-bar-fill"
                                style={{ width: `${Math.min(100, sharePercent)}%` }}
                              />
                            </div>
                            <span className="share-bar-text">{sharePercent}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Phân bổ trạng thái đơn hàng toàn chuỗi */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <h2>Trạng thái đơn hàng toàn chuỗi</h2>
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
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. BRANCH DASHBOARD VIEW (Khi xem 1 chi nhánh cụ thể hoặc là branch_manager)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard">
      <header className="dash-head">
        <div>
          <div className="dash-top-nav-row">
            <p className="dash-eyebrow">
              {currentBranch ? `Chi nhánh ${currentBranch.code || ""}` : "Bảng điều khiển chi nhánh"}
            </p>
            {isBrandOwner && (
              <button
                type="button"
                className="btn-back-to-brand"
                onClick={() => setSelectedBranchId("all")}
              >
                ← Về bảng điều khiển chuỗi thương hiệu
              </button>
            )}
          </div>
          <h1 className="dash-title">
            {currentBranch ? currentBranch.name : (merchant?.name || restaurantName || user?.name || "Cửa hàng của bạn")}
          </h1>
          {currentBranch?.address?.text && (
            <p className="dash-branch-address-text">{currentBranch.address.text}</p>
          )}
        </div>

        <div className="dash-head-actions">
          <div className={`dash-open-switch ${isOpen ? "is-open" : "is-closed"}`}>
            <span className="dash-open-label">
              {isOpen ? "Đang mở cửa" : "Đang đóng"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isOpen}
              aria-label="Toggle whether the restaurant is open"
              className="dash-open-track"
              onClick={handleToggleClick}
              disabled={savingOpen}
            >
              <span className="dash-open-thumb" />
            </button>
          </div>

          <Link to="/orders" className="dash-head-link">
            Quản lý đơn
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <ConfirmModal
        open={showConfirmClose}
        title="Tạm đóng chi nhánh?"
        message="Khách hàng sẽ không thể đặt đơn mới tại chi nhánh này cho đến khi bạn mở lại."
        confirmText="Tạm đóng chi nhánh"
        cancelText="Hủy"
        danger={true}
        isLoading={savingOpen}
        onConfirm={() => {
          setShowConfirmClose(false);
          doToggleOpen(false);
        }}
        onClose={() => setShowConfirmClose(false)}
      />

      {!isOpen && (
        <p className="dash-closed-note">
          Chi nhánh này đang tạm đóng. Khách hàng sẽ không thấy chi nhánh để đặt món — bật công tắc phía trên khi bạn sẵn sàng mở bán lại.
        </p>
      )}

      <section className="dash-stats">
        <StatCard
          icon={ClipboardList}
          label="Đơn hôm nay"
          value={loading ? "—" : stats.todayOrders}
        />
        <StatCard
          icon={DollarSign}
          label="Doanh thu hôm nay"
          value={loading ? "—" : formatVND(stats.todayRevenue)}
        />
        <StatCard
          icon={Clock}
          label="Cần xử lý"
          value={loading ? "—" : stats.needsAction}
          highlight={!loading && stats.needsAction > 0}
        />
        <StatCard
          icon={UtensilsCrossed}
          label="Món ăn"
          value={loading || menuCount === null ? "—" : menuCount}
        />
      </section>

      <section className="dash-panel">
        <div className="dash-panel-head">
          <h2>Trạng thái đơn hàng</h2>
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
          <h2>Đơn hàng gần đây</h2>
          <Link to="/orders" className="dash-panel-link">
            Xem tất cả
          </Link>
        </div>

        {loading ? (
          <div className="dash-recent-empty">Đang tải…</div>
        ) : recent.length === 0 ? (
          <div className="dash-recent-empty">
            Chưa có đơn hàng nào tại chi nhánh này. Đơn hàng sẽ xuất hiện khi có khách đặt.
          </div>
        ) : (
          <ul className="dash-recent">
            {recent.map((order) => (
              <li className="dash-recent-item" key={order._id}>
                <div className="dash-recent-main">
                  <p className="dash-recent-name">
                    {order.shippingAddress?.fullName || "Khách hàng"}
                  </p>
                  <p className="dash-recent-meta">
                    {(order.orderItems || []).length} món ·{" "}
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

const StatCard = ({ icon: Icon, label, value, highlight, sublabel, badge }) => (
  <article className={`dash-stat ${highlight ? "is-alert" : ""}`}>
    <span className="dash-stat-icon">
      <Icon size={18} />
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p className="dash-stat-label">{label}</p>
        {badge && <span className="stat-card-badge">{badge}</span>}
      </div>
      <p className="dash-stat-value">{value}</p>
      {sublabel && <p className="dash-stat-sublabel">{sublabel}</p>}
    </div>
  </article>
);

export default Dashboard;

