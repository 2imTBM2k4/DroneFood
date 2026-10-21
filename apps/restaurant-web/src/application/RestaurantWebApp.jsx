import React, { useEffect, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar/Sidebar';
import BranchSelector from '../components/BranchSelector/BranchSelector';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Dashboard from '../pages/Dashboard/Dashboard';
import List from '../pages/List/List';
import Orders from '../pages/Orders/Orders';
import EditRestaurant from '../pages/EditRestaurant/EditRestaurant';
import Branches from '../pages/Branches/Branches';
import Login from '../pages/Login/Login';
import Register from '../pages/Register/Register';
import Withdrawals from '../pages/Withdrawals/Withdrawals';
import ProtectedRoute from '../components/ProtectedRoute';
import { ToastContainer } from '@drone-food/web-ui/utils/toast';
import '@drone-food/web-ui/toast.css';
import {
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from '../components/Sidebar/sidebarState';

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
        transform: isVisible ? 'none' : 'translateY(12px)',
        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
      }}
    >
      {children}
    </div>
  );
};

const DashboardLayout = () => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readSidebarCollapsed()
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const mobileTriggerRef = useRef(null);
  const mobileCloseRef = useRef(null);
  const mobileSidebarWasOpen = useRef(false);

  useEffect(() => {
    writeSidebarCollapsed(window.localStorage, sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileSidebarOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
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

  return (
    <div
      className={`app restaurant-shell ${
        sidebarCollapsed ? 'sidebar-is-collapsed' : ''
      }`}
    >
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
        <header className="restaurant-topbar">
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
          <div className="topbar-branch-selector">
            <BranchSelector />
          </div>
        </header>
        <div className="page-content">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </div>
    </div>
  );
};

const RestaurantWebApp = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  return (
    <div>
      <ToastContainer position="top-right" limit={4} pauseOnHover={false} autoClose={4000} closeButton={false} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard url={url} />} />
          <Route path="/add" element={<Navigate to="/list?add=1" replace />} />
          <Route path="/list" element={<List url={url} />} />
          <Route
            path="/orders"
            element={
              <ProtectedRoute allowedRoles={["branch_manager", "restaurant_owner", "merchant_owner", "admin"]}>
                <Orders url={url} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/branches"
            element={
              <ProtectedRoute allowedRoles={["merchant_owner", "admin"]}>
                <Branches url={url} />
              </ProtectedRoute>
            }
          />
          <Route path="/edit-restaurant" element={<EditRestaurant url={url} />} />
          <Route path="/drone-delivery" element={<Navigate to="/edit-restaurant?tab=drone" replace />} />
          <Route path="/withdrawals" element={<Navigate to="/wallet" replace />} />
          <Route
            path="/wallet"
            element={
              <ProtectedRoute allowedRoles={["merchant_owner", "restaurant_owner", "admin"]}>
                <Withdrawals url={url} />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </div>
  );
};

export default RestaurantWebApp;
