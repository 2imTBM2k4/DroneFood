import { useContext, useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../shared/toast.css";
import Navbar from "./components/Navbar/Navbar";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home/Home";
import Cart from "./pages/Cart/Cart";
import Checkout from "./pages/Checkout/Checkout";
import Footer from "./components/Footer/Footer";
import LoginPopup from "./components/LoginPopup/LoginPopup";
import Verify from "./pages/Verify/Verify";
import MyOrders from "./pages/MyOrders/MyOrders";
import Profile from "./pages/Profile/Profile";
import ProductDetail from "./pages/ProductDetail/ProductDetail";
import { StoreContext } from "./context/StoreContext";
import RestaurantsPage from "./pages/Restaurants/RestaurantsPage";
import RestaurantPage from "./pages/Restaurant/RestaurantPage";
import FloatingCartBar from "./components/FloatingCartBar/FloatingCartBar";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import OrderDetail from "./pages/OrderDetail/OrderDetail";
import ActiveOrderBar from "./components/ActiveOrderBar/ActiveOrderBar";

const PageTransition = ({ children }) => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Without this a route change keeps the previous page's scroll offset,
    // which can land the new page on empty space below its content.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

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

const App = () => {
  const { showLogin, setShowLogin } = useContext(StoreContext);

  return (
    <>
      {showLogin && <LoginPopup setShowLogin={setShowLogin} />}
      <div className="main-content">
        <Navbar setShowLogin={setShowLogin} />
        <PageTransition>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/restaurants" element={<RestaurantsPage />} />
            {/* the old dish-browsing route now lands on the restaurant list */}
            <Route path="/food" element={<Navigate to="/restaurants" replace />} />
            <Route path="/restaurant/:id" element={<RestaurantPage />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/myorders" element={<MyOrders />} />
            <Route path="/myorders/:id" element={<OrderDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            {/* The old three-route flow (Cart → PlaceOrder → Payment) is now
                one page; keep the old paths working for saved links. */}
            <Route path="/order" element={<Navigate to="/checkout" replace />} />
            <Route
              path="/placeorder"
              element={<Navigate to="/checkout" replace />}
            />
            <Route
              path="/payment"
              element={<Navigate to="/checkout" replace />}
            />
          </Routes>
        </PageTransition>
      </div>
      <Footer />
      <FloatingCartBar />
      <ActiveOrderBar />
      <ToastContainer position="bottom-center" pauseOnHover={false} />
    </>
  );
};

export default App;
