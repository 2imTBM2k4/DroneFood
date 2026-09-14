import React, { useContext, useState, useEffect } from "react";
import "./Navbar.css";
import { Sun, Moon } from "lucide-react";
import { assets } from "../../assets/assets";
import { AuthContext } from "../../context/AuthContext";
import { formatVND } from "../../../../shared/utils/money";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("mode") === "dark");

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
