import React, { useCallback, useContext, useEffect, useState } from "react";
import "./Sidebar.css";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Moon,
  Store,
  Sun,
  UtensilsCrossed,
  WalletCards,
  X,
  Building2,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from "lucide-react";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import { io } from "socket.io-client";
import NotificationBell from "@drone-food/web-ui/components/NotificationBell";
import ConfirmModal from "@drone-food/web-ui/components/ConfirmModal";
import { formatVND } from "@drone-food/web-ui/utils/money";
import { assets } from "../../assets/assets";
import { AuthContext } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";

const getMenuSections = (role) => {
  const isBranchManager = role === "branch_manager";

  let managementItems = [];

  if (isBranchManager) {
    // Quản lý chi nhánh: Thực đơn chi nhánh, Đơn hàng chi nhánh, Hồ sơ chi nhánh
    managementItems = [
      { path: "/list", icon: UtensilsCrossed, label: "Thực đơn chi nhánh" },
      { path: "/orders", icon: ClipboardList, label: "Đơn hàng" },
      { path: "/edit-restaurant", icon: Store, label: "Hồ sơ chi nhánh" },
    ];
  } else {
    // Quản lý thương hiệu: Thực đơn gốc, Quản lý chi nhánh, Ví tiền, Hồ sơ thương hiệu
    // (Bỏ phần quản lý đơn hàng - đơn hàng do từng chi nhánh phụ trách)
    managementItems = [
      { path: "/list", icon: UtensilsCrossed, label: "Thực đơn gốc" },
      { path: "/branches", icon: Building2, label: "Chi nhánh" },
      { path: "/wallet", icon: WalletCards, label: "Ví tiền" },
      { path: "/edit-restaurant", icon: Store, label: "Hồ sơ thương hiệu" },
    ];
  }

  return [
    {
      label: "Tổng quan",
      items: [{ path: "/dashboard", icon: LayoutDashboard, label: "Bảng điều khiển" }],
    },
    {
      label: "Quản trị",
      items: managementItems,
    },
  ];
};

const Sidebar = ({
  collapsed = false,
  mobileOpen = false,
  mobileCloseButtonRef,
  onToggleCollapsed,
  onMobileClose,
}) => {
  const { user, logout } = useContext(AuthContext);
  const { branches, currentBranch, refreshBranches } = useBranch();
  const navigate = useNavigate();

  const isBranchManager = user?.role === "branch_manager";
  const targetBranch = isBranchManager ? currentBranch || branches[0] : null;
  const isBranchOpen = targetBranch ? targetBranch.isOpen !== false : true;
  const [togglingOpen, setTogglingOpen] = useState(false);

  const handleToggleBranchOpen = async (e) => {
    e?.stopPropagation?.();
    if (!targetBranch?._id || togglingOpen) return;
    try {
      setTogglingOpen(true);
      const nextOpen = !isBranchOpen;
      const res = await axios.patch(
        `${apiUrl}/api/branch/${targetBranch._id}/open-state`,
        { isOpen: nextOpen },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        notificationService.success(
          nextOpen ? "Chi nhánh đã mở cửa nhận đơn" : "Chi nhánh đã tạm đóng cửa",
          targetBranch.name,
          { audience: "restaurant" }
        );
        refreshBranches();
      }
    } catch (err) {
      notificationService.error(
        "Không thể đổi trạng thái mở cửa",
        err.response?.data?.message || err.message,
        { audience: "restaurant", priority: "high" }
      );
    } finally {
      setTogglingOpen(false);
    }
  };

  const [isDark, setIsDark] = useState(
    () => localStorage.getItem("mode") === "dark"
  );
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const token = localStorage.getItem("token") || "";
  const connectRealtime = useCallback(
    () => io(apiUrl, { auth: { token } }),
    [apiUrl, token]
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark-mode", isDark);
    localStorage.setItem("mode", isDark ? "dark" : "light");
  }, [isDark]);

  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const handleLogout = () => {
    setLogoutModalOpen(true);
  };

  const restaurantName = user?.name || user?.restaurant?.name || "Restaurant";
  const restaurantSubtitle =
    user?.email ||
    (user?.role === "merchant_owner"
      ? "Merchant Owner"
      : user?.role === "branch_manager"
      ? "Branch Manager"
      : "Restaurant partner");

  return (
    <aside
      className={`sidebar restaurant-sidebar ${collapsed ? "is-collapsed" : ""} ${
        mobileOpen ? "mobile-open" : ""
      }`}
      aria-label="Restaurant navigation"
    >
      <header className="sidebar-header">
        <div className="sidebar-brand" aria-label="Drone Food Restaurant">
          <span className="sidebar-brand-mark" aria-hidden="true">
            <Store size={20} />
          </span>
          <span className="sidebar-brand-copy">
            <strong>Drone Food</strong>
            <small>Restaurant partner</small>
          </span>
        </div>

        <button
          type="button"
          className="sidebar-collapse-button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="restaurant-sidebar-navigation"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? (
            <ChevronRight size={18} aria-hidden="true" />
          ) : (
            <ChevronLeft size={18} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          ref={mobileCloseButtonRef}
          className="sidebar-mobile-close"
          aria-label="Close navigation menu"
          onClick={onMobileClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <nav id="restaurant-sidebar-navigation" className="sidebar-navigation">
        {getMenuSections(user?.role).map((section) => (
          <section className="sidebar-section" key={section.label}>
            <p className="sidebar-section-label">{section.label}</p>
            <div className="sidebar-options">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-option ${isActive ? "active" : ""}`
                  }
                  end={item.path === "/dashboard"}
                  title={collapsed ? item.label : undefined}
                  onClick={onMobileClose}
                >
                  <item.icon className="sidebar-icon" size={20} aria-hidden="true" />
                  <span className="sidebar-option-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <footer className="sidebar-footer">
        <div className="sidebar-tools" aria-label="Restaurant utilities">
          <button
            type="button"
            className="sidebar-tool"
            aria-label={isDark ? "Use light theme" : "Use dark theme"}
            title={collapsed ? (isDark ? "Light theme" : "Dark theme") : undefined}
            onClick={() => setIsDark((value) => !value)}
          >
            {isDark ? (
              <Sun size={19} aria-hidden="true" />
            ) : (
              <Moon size={19} aria-hidden="true" />
            )}
            <span>{isDark ? "Light theme" : "Dark theme"}</span>
          </button>

          <div className="sidebar-notifications">
            <NotificationBell
              apiUrl={apiUrl}
              token={token}
              connectRealtime={connectRealtime}
              navigate={navigate}
              soundForNewOrder
            />
            <span className="sidebar-notification-label">Notifications</span>
          </div>
        </div>

        {/* Trạng thái mở cửa cho Quản lý chi nhánh / Số dư ví cho Chủ thương hiệu */}
        {isBranchManager ? (
          <div
            className={`sidebar-branch-toggle ${isBranchOpen ? "open" : "closed"}`}
            onClick={handleToggleBranchOpen}
            role="button"
            tabIndex={0}
            title={
              collapsed
                ? `Chi nhánh: ${isBranchOpen ? "Đang mở cửa (Bấm để đóng)" : "Đang đóng cửa (Bấm để mở)"}`
                : undefined
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleToggleBranchOpen(e);
              }
            }}
          >
            <div className="sidebar-branch-toggle-left">
              <Store size={19} className="sidebar-branch-icon" />
              <span className={`sidebar-branch-dot ${isBranchOpen ? "dot-open" : "dot-closed"}`} />
            </div>
            <div className="sidebar-branch-toggle-copy">
              <small>{targetBranch?.code ? `Chi nhánh ${targetBranch.code}` : "Chi nhánh"}</small>
              <strong>{isBranchOpen ? "Đang mở cửa" : "Tạm đóng cửa"}</strong>
            </div>
            <button
              type="button"
              className="sidebar-branch-switch-btn"
              disabled={togglingOpen}
              aria-label={isBranchOpen ? "Đóng cửa chi nhánh" : "Mở cửa chi nhánh"}
            >
              {togglingOpen ? (
                <Loader2 size={18} className="spin" />
              ) : isBranchOpen ? (
                <ToggleRight size={26} className="toggle-icon-on" />
              ) : (
                <ToggleLeft size={26} className="toggle-icon-off" />
              )}
            </button>
          </div>
        ) : (
          user && (
            <div
              className="sidebar-balance"
              title={collapsed ? `Balance: ${formatVND(user.walletBalance)}` : undefined}
              onClick={() => {
                navigate("/wallet");
                onMobileClose?.();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  navigate("/wallet");
                  onMobileClose?.();
                }
              }}
            >
              <WalletCards size={19} aria-hidden="true" />
              <span>
                <small>Balance</small>
                <strong>{formatVND(user.walletBalance)}</strong>
              </span>
            </div>
          )
        )}

        <div className="sidebar-account">
          <img
            className="sidebar-avatar"
            src={user?.restaurantImage || user?.restaurant?.image || assets.profile_image}
            alt=""
          />
          <span className="sidebar-account-copy">
            <strong>{restaurantName}</strong>
            <small>{restaurantSubtitle}</small>
          </span>
          <button
            type="button"
            className="sidebar-logout"
            aria-label="Logout"
            title="Logout"
            onClick={handleLogout}
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </footer>
      <ConfirmModal
        open={logoutModalOpen}
        title="Đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất khỏi trang Nhà hàng?"
        confirmText="Đăng xuất"
        cancelText="Ở lại"
        danger
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={logout}
      />
    </aside>
  );
};

export default Sidebar;
