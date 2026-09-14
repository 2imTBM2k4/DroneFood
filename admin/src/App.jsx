import React, { useContext, useEffect, useState } from "react";
import Navbar from "./components/Navbar/Navbar";
import Sidebar from "./components/Sidebar/Sidebar";
import { Routes, Route, useLocation } from "react-router-dom";
import ListRestaurant from "./pages/ListRestaurant/ListRestaurant";
import Orders from "./pages/Orders/Orders";
import Dashboard from "./pages/Dashboard/Dashboard";
import ListUsers from "./pages/ListUsers/ListUsers";
import Login from "./pages/Login/Login";
import Drones from "./pages/Drones/Drones";
import AuditLog from "./pages/AuditLog/AuditLog";
import Shippers from "./pages/Shippers/Shippers";
import Vouchers from "./pages/Vouchers/Vouchers";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthContext } from "./context/AuthContext";

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
        transform: isVisible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
      }}
    >
      {children}
    </div>
  );
};

const App = () => {
  const { user, isLoading } = useContext(AuthContext);
  const url = import.meta.env.VITE_API_URL || "http://localhost:4000";

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="app">
        <ToastContainer />
        <Login url={url} />
      </div>
    );
  }

  return (
    <div className="app">
      <ToastContainer />
      <Sidebar />
      <div className="main-content-area">
        <Navbar />
        <div className="page-content">
          <PageTransition>
            <Routes>
              <Route path="/" element={<Dashboard url={url} />} />
              <Route
                path="/list-restaurants"
                element={<ListRestaurant url={url} />}
              />
              <Route path="/list-users" element={<ListUsers url={url} />} />
              <Route path="/orders" element={<Orders url={url} />} />
              <Route path="/drones" element={<Drones url={url} />} />
              <Route path="/shippers" element={<Shippers url={url} />} />
              <Route path="/vouchers" element={<Vouchers url={url} />} />
              <Route path="/audit" element={<AuditLog url={url} />} />
            </Routes>
          </PageTransition>
        </div>
      </div>
    </div>
  );
};

export default App;
