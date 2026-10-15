import React, { useContext, useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import { Routes, Route, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import ListRestaurant from "../pages/ListRestaurant/ListRestaurant";
import Merchants from "../pages/Merchants/Merchants";
import Branches from "../pages/Branches/Branches";
import Orders from "../pages/Orders/Orders";
import Dashboard from "../pages/Dashboard/Dashboard";
import ListUsers from "../pages/ListUsers/ListUsers";
import Login from "../pages/Login/Login";
import Drones from "../pages/Drones/Drones";
import AuditLog from "../pages/AuditLog/AuditLog";
import Shippers from "../pages/Shippers/Shippers";
import Vouchers from "../pages/Vouchers/Vouchers";
import Refunds from "../pages/Refunds/Refunds";
import Withdrawals from "../pages/Withdrawals/Withdrawals";
import Finance from "../pages/Finance/Finance";
import { ToastContainer } from "@drone-food/web-ui/utils/toast";
import "@drone-food/web-ui/toast.css";
import { AuthContext } from "../context/AuthContext";
import {
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from "../components/Sidebar/sidebarState";

const PageTransition = ({ children }) => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(false);
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
    return () => cancelAnimationFrame(t);
  }, [location.pathname]);

  return (
    <div
      className="page-transition"
      style={{
        opacity: isVisible ? 1 : 0,
        // MUST be `none` at rest, not translateY(0): any transform other than
        // none makes this element the containing block for position:fixed
        // descendants, which breaks every modal rendered inside a page.
        transform: isVisible ? "none" : "translateY(12px)",
        transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
      }}
    >
      {children}
    </div>
  );
};

const AdminWebApp = () => {
  const { user, isInitializing } = useContext(AuthContext);
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readSidebarCollapsed()
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const mobileTriggerRef = useRef(null);
  const mobileCloseRef = useRef(null);
  const mobileSidebarWasOpen = useRef(false);
  const url = import.meta.env.VITE_API_URL || "http://localhost:4000";

  useEffect(() => {
    writeSidebarCollapsed(window.localStorage, sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (mobileSidebarOpen) {
      mobileSidebarWasOpen.current = true;
      mobileCloseRef.current?.focus();
      return;
    }

    if (mobileSidebarWasOpen.current) {
      mobileSidebarWasOpen.current = false;
      mobileTriggerRef.current?.focus();
    }
  }, [mobileSidebarOpen]);

  if (isInitializing) {
    return <div>Loading...</div>;
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="app">
        <ToastContainer position="top-right" limit={4} pauseOnHover={false} autoClose={4000} closeButton={false} />
        <Login url={url} />
      </div>
    );
  }

  return (
    <div
      className={`app admin-shell ${
        sidebarCollapsed ? "sidebar-is-collapsed" : ""
      }`}
    >
      <ToastContainer position="top-right" limit={4} pauseOnHover={false} autoClose={4000} closeButton={false} />
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        mobileCloseButtonRef={mobileCloseRef}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      {mobileSidebarOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation menu"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <div className="main-content-area">
        <button
          type="button"
          ref={mobileTriggerRef}
          className="sidebar-mobile-trigger"
          aria-label="Open navigation menu"
          aria-expanded={mobileSidebarOpen}
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <div className="page-content">
          <PageTransition>
            <Routes>
              <Route path="/" element={<Dashboard url={url} />} />
              <Route path="/merchants" element={<Merchants url={url} />} />
              <Route path="/branches" element={<Branches url={url} />} />
              <Route
                path="/list-restaurants"
                element={<ListRestaurant url={url} />}
              />
              <Route path="/list-users" element={<ListUsers url={url} />} />
              <Route path="/orders" element={<Orders url={url} />} />
              <Route path="/drones" element={<Drones url={url} />} />
              <Route path="/shippers" element={<Shippers url={url} />} />
              <Route path="/vouchers" element={<Vouchers url={url} />} />
              <Route path="/finance" element={<Finance url={url} />} />
              <Route path="/refunds" element={<Refunds url={url} />} />
              <Route path="/withdrawals" element={<Withdrawals url={url} />} />
              <Route path="/audit" element={<AuditLog url={url} />} />
            </Routes>
          </PageTransition>
        </div>
      </div>
    </div>
  );
};

export default AdminWebApp;
