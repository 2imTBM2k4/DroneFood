import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar/Navbar';
import Sidebar from './components/Sidebar/Sidebar';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard/Dashboard';
import List from './pages/List/List';
import Orders from './pages/Orders/Orders';
import EditRestaurant from './pages/EditRestaurant/EditRestaurant';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import Withdrawals from './pages/Withdrawals/Withdrawals';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../../shared/toast.css';

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
        transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
      }}
    >
      {children}
    </div>
  );
};

const DashboardLayout = () => {
  return (
    <>
      <Navbar />
      <div className="app-content">
        <Sidebar />
        <div className="page-content">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </div>
    </>
  );
};

const App = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  return (
    <div>
      <ToastContainer position="bottom-center" pauseOnHover={false} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard url={url} />} />
          <Route path="/add" element={<Navigate to="/list?add=1" replace />} />
          <Route path="/list" element={<List url={url} />} />
          <Route path="/orders" element={<Orders url={url} />} />
          <Route path="/edit-restaurant" element={<EditRestaurant url={url} />} />
          <Route path="/withdrawals" element={<Navigate to="/wallet" replace />} />
          <Route path="/wallet" element={<Withdrawals url={url} />} />
        </Route>
      </Routes>
    </div>
  );
};

export default App;
