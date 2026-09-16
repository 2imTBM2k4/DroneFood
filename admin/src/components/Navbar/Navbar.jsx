import React, { useContext, useState, useEffect, useCallback } from "react";
import "./Navbar.css";
import { Sun, Moon } from "lucide-react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { assets } from "../../assets/assets";
import { AuthContext } from "../../context/AuthContext";
import { formatVND } from "../../../../shared/utils/money";
import NotificationBell from "../../../../shared/components/NotificationBell";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("mode") === "dark");
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const token = localStorage.getItem("token") || "";
  const connectRealtime = useCallback(() => io(apiUrl, { auth: { token } }), [apiUrl, token]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark-mode");
      localStorage.setItem("mode", "dark");
    } else {
      root.classList.remove("dark-mode");
      localStorage.setItem("mode", "light");
    }
  }, [isDark]);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  return (
    <div className="navbar">
      <div className="brand">
        <span className="brand-mark">Drone Food</span>
        <span className="brand-role">Admin</span>
      </div>
      <div className="navbar-right">
        <button
          className="theme-toggle"
          onClick={() => setIsDark(!isDark)}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <NotificationBell apiUrl={apiUrl} token={token} connectRealtime={connectRealtime} navigate={navigate} />
        {user && (
          <span className="balance">
            Balance: {formatVND(user.walletBalance)}
          </span>
        )}
        <img className="profile" src={assets.profile_image} alt="Profile" />
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>
    </div>
  );
};

export default Navbar;
