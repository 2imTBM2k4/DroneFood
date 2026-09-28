import { useContext, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag, ChevronRight } from "lucide-react";
import "./FloatingCartBar.css";
import { StoreContext } from "../../context/StoreContext";
import { formatVND } from "@drone-food/web-ui/utils/money";

const FloatingCartBar = () => {
  const { cartForRestaurant, cartDetails, loadCartDetail, token } = useContext(StoreContext);
  const location = useLocation();
  const navigate = useNavigate();

  const match = location.pathname.match(/^\/restaurant\/([^/]+)$/);
  const summary = match ? cartForRestaurant(decodeURIComponent(match[1])) : null;
  const cart = summary ? cartDetails[summary.cartId] : null;
  const itemCount = cart?.items?.reduce((sum, line) => sum + line.quantity, 0) || summary?.itemCount || 0;
  const isHidden = !token || !match || !summary || itemCount === 0;
  const total = cart?.subtotal || 0;

  useEffect(() => {
    if (summary?.cartId && !cart) loadCartDetail(summary.cartId);
  }, [cart, loadCartDetail, summary?.cartId]);

  return (
    <aside
      className={`apple-floating-sticky-bar ${isHidden ? "" : "visible"}`}
      aria-hidden={isHidden}
    >
      <div className="apple-sticky-bar-inner">
        <div className="apple-sticky-bar-left">
          <span className="apple-sticky-bag-icon">
            <ShoppingBag size={18} />
            <span className="apple-sticky-bag-badge">{itemCount}</span>
          </span>
          <div className="apple-sticky-bar-pricing">
            <span className="apple-sticky-item-count">
              {itemCount} {itemCount === 1 ? "dish selected" : "dishes selected"}
            </span>
            <span className="apple-sticky-total">{formatVND(total)}</span>
          </div>
        </div>

        <div className="apple-sticky-bar-right">
          <button
            type="button"
            className="btn-apple-primary button-primary apple-sticky-cta"
            onClick={() => navigate(`/cart/${summary?.cartId}`)}
            tabIndex={isHidden ? -1 : 0}
          >
            <span>Review Bag</span>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default FloatingCartBar;
