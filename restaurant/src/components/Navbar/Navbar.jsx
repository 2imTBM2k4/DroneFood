import React, { useState, useEffect, useContext, useRef } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Wallet, ChevronDown, LogOut, Settings, Sun, Moon } from "lucide-react";
import { formatVND } from "../../../../shared/utils/money";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("mode") === "dark");
  const dropdownRef = useRef(null);

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

        {user ? (
          <>
            <div className="wallet-badge">
              <Wallet size={16} />
              <span>{formatVND(user.walletBalance)}</span>
            </div>

            <div className="account-menu" ref={dropdownRef}>
              <button
                className="account-trigger"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <img
                  className="avatar"
                  src={assets.profile_image}
                  alt="Profile"
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
                    <span>Settings</span>
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
