import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Wallet, ChevronDown, LogOut, Settings, Sun, Moon } from "lucide-react";
import { io } from "socket.io-client";
import { formatVND } from "../../../../shared/utils/money";
import NotificationBell from "../../../../shared/components/NotificationBell";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("mode") === "dark");
  const dropdownRef = useRef(null);
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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <span className="brand-mark">Drone Food</span>
        <span className="brand-role">Restaurant</span>
      </div>

      <div className="navbar-right">
        <button
          className="theme-toggle"
          onClick={() => setIsDark(!isDark)}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <NotificationBell apiUrl={apiUrl} token={token} connectRealtime={connectRealtime} navigate={navigate} soundForNewOrder />

        {user ? (
          <>
            <button type="button" className="wallet-badge" onClick={() => navigate("/wallet")} aria-label="Open restaurant wallet">
              <Wallet size={16} />
              <span>{formatVND(user.walletBalance)}</span>
            </button>

            <div className="account-menu" ref={dropdownRef}>
              <button
                className="account-trigger"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <img
                  className="avatar"
                  src={user.restaurantImage || user.restaurant?.image || assets.profile_image}
                  alt="Restaurant profile"
                />
                <span className="account-name">
                  {user.name || "Restaurant"}
                </span>
                <ChevronDown size={16} className={`chevron ${dropdownOpen ? "open" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="dropdown">
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/edit-restaurant");
                    }}
                  >
                    <Settings size={16} />
                    <span>Profile</span>
                  </button>
                  <div className="dropdown-divider" />
                  <button
                    className="dropdown-item dropdown-item--danger"
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={16} />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button className="login-btn" onClick={() => navigate("/login")}>
            Login
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
