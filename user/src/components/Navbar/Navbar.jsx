import { useState, useEffect, useRef, useContext, useCallback } from "react";
import "./Navbar.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ShoppingBag,
  LogOut,
  Sun,
  Moon,
  MapPin,
  UserRound,
  Plane,
} from "lucide-react";
import { io } from "socket.io-client";
import { StoreContext } from "../../context/StoreContext";
import Avatar from "../Avatar/Avatar";
import NotificationBell from "../../../../shared/components/NotificationBell";

const Navbar = ({ setShowLogin }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("mode") === "dark");
  const [scrolled, setScrolled] = useState(false);
  const { getCartItemCount, token, setToken, user, liveLocation, liveAddress, activeAddressId, setActiveAddressId } =
    useContext(StoreContext);
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef(null);

  const cartCount = getCartItemCount();
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const connectRealtime = useCallback(() => io(apiUrl, { auth: { token } }), [apiUrl, token]);

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    navigate("/");
  };

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
    setMobileMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const savedAddresses = user?.addressBook || [];
  const selectedSavedAddress = savedAddresses.find((entry) => String(entry.id || entry._id) === activeAddressId);
  const addr = selectedSavedAddress || liveAddress || user?.address;
  const deliveryAddress = addr
    ? addr.formatted || [addr.address || addr.street, addr.city].filter(Boolean).join(", ")
    : liveLocation
    ? "Updating location…"
    : "";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  return (
    <header className={`apple-navbar-wrapper ${scrolled ? "scrolled" : ""}`}>
      <nav className="apple-unified-nav" aria-label="Main Navigation">
        <div className="apple-nav-inner">
          {/* Brand */}
          <Link to="/" className="apple-nav-brand" aria-label="Drone Food Home">
            <Plane className="apple-logo-glyph" size={17} strokeWidth={1.8} aria-hidden="true" />
            <span className="apple-brand-title">DroneFood</span>
          </Link>

          {/* Center: Clean links & location */}
          <div className="apple-nav-center">
            <Link
              to="/restaurants"
              className={`apple-nav-link ${location.pathname.startsWith("/restaurants") ? "active" : ""}`}
            >
              Restaurants
            </Link>

            {token && (
              <Link
                to="/myorders"
                className={`apple-nav-link ${location.pathname === "/myorders" ? "active" : ""}`}
              >
                Orders
              </Link>
            )}

            {deliveryAddress && (
              <label className="apple-nav-location" title={deliveryAddress}>
                <MapPin size={12} className="apple-location-icon" />
                {savedAddresses.length > 0 ? <select className="apple-location-select" value={activeAddressId} onChange={(event) => setActiveAddressId(event.target.value)} aria-label="Delivery address">
                  {savedAddresses.map((entry) => <option key={entry.id || entry._id} value={entry.id || entry._id}>{entry.label}: {entry.address}, {entry.city}</option>)}
                </select> : <span className="apple-location-text">{deliveryAddress}</span>}
              </label>
            )}
          </div>

          {/* Right Actions */}
          <div className="apple-nav-actions">
            <button
              className="apple-icon-btn"
              onClick={() => setIsDark(!isDark)}
              aria-label="Toggle theme"
              title={isDark ? "Light Mode" : "Dark Mode"}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <Link
              to="/cart"
              className="apple-icon-btn apple-bag-btn"
              aria-label={`Shopping Bag, ${cartCount} items`}
            >
              <ShoppingBag size={17} />
              {cartCount > 0 && <span className="apple-bag-count">{cartCount}</span>}
            </Link>

            <NotificationBell apiUrl={apiUrl} token={token} connectRealtime={connectRealtime} navigate={navigate} />

            {!token ? (
              <button
                className="btn-apple-dark-utility"
                onClick={() => setShowLogin(true)}
              >
                Sign In
              </button>
            ) : (
              <div
                className={`apple-profile-container ${profileOpen ? "open" : ""}`}
                ref={profileRef}
              >
                <button
                  type="button"
                  className="apple-profile-trigger"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  aria-label="Account menu"
                  aria-expanded={profileOpen}
                >
                  <Avatar src={user?.avatar} name={user?.name} size={30} />
                </button>
                {profileOpen && (
                  <ul className="apple-profile-dropdown">
                    <li onClick={() => navigate("/profile")}>
                      <UserRound size={15} />
                      <span>Account</span>
                    </li>
                    <li onClick={() => navigate("/myorders")}>
                      <ShoppingBag size={15} />
                      <span>Orders</span>
                    </li>
                    <li onClick={logout} className="apple-logout-item">
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </li>
                  </ul>
                )}
              </div>
            )}

            <button
              className={`apple-hamburger ${mobileMenuOpen ? "open" : ""}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              <span />
              <span />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="apple-mobile-drawer">
          <Link to="/" className="apple-mobile-link" onClick={() => setMobileMenuOpen(false)}>
            Home
          </Link>
          <Link
            to="/restaurants"
            className="apple-mobile-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Restaurants
          </Link>
          {token && (
            <Link
              to="/myorders"
              className="apple-mobile-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              Orders
            </Link>
          )}
          <Link
            to="/cart"
            className="apple-mobile-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Shopping Bag ({cartCount})
          </Link>
          {deliveryAddress && (
            <div className="apple-mobile-addr">
              <MapPin size={13} />
              {savedAddresses.length > 0 ? <select className="apple-location-select" value={activeAddressId} onChange={(event) => setActiveAddressId(event.target.value)} aria-label="Delivery address">
                {savedAddresses.map((entry) => <option key={entry.id || entry._id} value={entry.id || entry._id}>{entry.label}: {entry.address}, {entry.city}</option>)}
              </select> : <span>{deliveryAddress}</span>}
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
