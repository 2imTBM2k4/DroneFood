import React from "react";
import "./Sidebar.css";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Users,
  ClipboardList,
  Plane,
  Bike,
  ScrollText,
} from "lucide-react";

const Sidebar = ({ mobileOpen = false, onMobileToggle }) => {
  // SỬA: Thêm props cho mobile
  // One distinct icon per destination — the old PNG set reused the same
  // image for Dashboard and Restaurants.
  const menuItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/list-restaurants", icon: Store, label: "Restaurants" },
    { path: "/list-users", icon: Users, label: "Users" },
    { path: "/orders", icon: ClipboardList, label: "Orders" },
    { path: "/drones", icon: Plane, label: "Drones" },
    { path: "/shippers", icon: Bike, label: "Shippers" },
    { path: "/audit", icon: ScrollText, label: "Audit Log" },
  ];

  // SỬA: Function toggle cho mobile (gọi khi click close button hoặc menu item)
  const handleMobileToggle = () => {
    if (onMobileToggle) {
      onMobileToggle();
    }
  };

  return (
    <div className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      {" "}
      {/* SỬA: Thêm class động cho mobile */}
      <div className="sidebar-header">
        <h3 className="sidebar-title">Admin Panel</h3>
        {/* SỬA: Optional - Button đóng sidebar trên mobile */}
        {mobileOpen && window.innerWidth <= 768 && (
          <button
            onClick={handleMobileToggle}
            className="mobile-close-btn"
            style={{
              display: "block",
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "white",
              fontSize: "1.5rem",
              cursor: "pointer",
              float: "right",
            }}
          >
            ×
          </button>
        )}
      </div>
      <div className="sidebar-options">
        {menuItems.map((item, index) => (
          <NavLink
            key={index}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-option ${isActive ? "active" : ""}`
            }
            end={item.path === "/"} // Use exact matching for dashboard
            onClick={handleMobileToggle} // SỬA: Đóng menu khi click item trên mobile
          >
            <item.icon className="sidebar-icon" size={20} />
            <p>{item.label}</p>
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
