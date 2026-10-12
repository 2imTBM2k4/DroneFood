import React, { useCallback, useContext, useEffect, useState } from "react";
import "./Sidebar.css";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bike,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Moon,
  Plane,
  ScrollText,
  ShieldCheck,
  Store,
  Sun,
  Ticket,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { io } from "socket.io-client";
import NotificationBell from "@drone-food/web-ui/components/NotificationBell";
import ConfirmModal from "@drone-food/web-ui/components/ConfirmModal";
import { formatVND } from "@drone-food/web-ui/utils/money";
import { assets } from "../../assets/assets";
import { AuthContext } from "../../context/AuthContext";

const menuSections = [
  {
    label: "Overview",
    items: [{ path: "/", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Management",
    items: [
      { path: "/merchants", icon: Store, label: "Merchants" },
      { path: "/branches", icon: Building2, label: "Branches" },
      { path: "/list-users", icon: Users, label: "Users" },
      { path: "/orders", icon: ClipboardList, label: "Orders" },
      { path: "/drones", icon: Plane, label: "Drones" },
      { path: "/shippers", icon: Bike, label: "Shippers" },
      { path: "/vouchers", icon: Ticket, label: "Vouchers" },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/finance", icon: HandCoins, label: "Financial Management" },
      { path: "/audit", icon: ScrollText, label: "Audit Log" },
    ],
  },
];

const Sidebar = ({
  collapsed = false,
  mobileOpen = false,
  mobileCloseButtonRef,
  onToggleCollapsed,
  onMobileClose,
}) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
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

  const adminName = user?.name || user?.email || "Admin";
  const adminEmail = user?.email || "System administrator";

  return (
    <aside
      className={`sidebar admin-sidebar ${collapsed ? "is-collapsed" : ""} ${
        mobileOpen ? "mobile-open" : ""
      }`}
      aria-label="Admin navigation"
    >
      <header className="sidebar-header">
        <div className="sidebar-brand" aria-label="Drone Food Admin">
          <span className="sidebar-brand-mark" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <span className="sidebar-brand-copy">
            <strong>Drone Food</strong>
            <small>Admin console</small>
          </span>
        </div>

        <button
          type="button"
          className="sidebar-collapse-button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="admin-sidebar-navigation"
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

      <nav id="admin-sidebar-navigation" className="sidebar-navigation">
        {menuSections.map((section) => (
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
                  end={item.path === "/"}
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
        <div className="sidebar-tools" aria-label="Admin utilities">
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
            />
            <span className="sidebar-notification-label">Notifications</span>
          </div>
        </div>

        {user && (
          <div
            className="sidebar-balance"
            title={collapsed ? `Balance: ${formatVND(user.walletBalance)}` : undefined}
          >
            <WalletCards size={19} aria-hidden="true" />
            <span>
              <small>Balance</small>
              <strong>{formatVND(user.walletBalance)}</strong>
            </span>
          </div>
        )}

        <div className="sidebar-account">
          <img className="sidebar-avatar" src={assets.profile_image} alt="" />
          <span className="sidebar-account-copy">
            <strong>{adminName}</strong>
            <small>{adminEmail}</small>
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
        message="Bạn có chắc chắn muốn đăng xuất khỏi trang Quản trị?"
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
