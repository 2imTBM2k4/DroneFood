import { useContext } from "react";
import { ChevronRight, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@drone-food/web-ui/components/StateBlock";
import { StoreContext } from "../../context/StoreContext";
import { cartMeta } from "../../lib/cartState";
import "./Cart.css";

const CartIndex = () => {
  const { cartSummaries, isHydrated } = useContext(StoreContext);
  const navigate = useNavigate();

  if (isHydrated && cartSummaries.length === 0) {
    return (
      <div className="cart cart-index">
        <EmptyState
          icon={ShoppingCart}
          title="Your carts are empty"
          description="Dishes you add from each restaurant will appear in their own cart."
          actionLabel="Browse restaurants"
          onAction={() => navigate("/restaurants")}
        />
      </div>
    );
  }

  return (
    <main className="cart cart-index">
      <div className="cart-index-head">
        <h1 className="cart-title">Your carts</h1>
        <p>{cartSummaries.length} {cartSummaries.length === 1 ? "restaurant" : "restaurants"}</p>
      </div>
      <div className="cart-group-list">
        {cartSummaries.map((cart) => {
          const meta = cartMeta(cart);
          return (
            <button
              type="button"
              className={`cart-group-card ${cart.restaurant?.isOpen === false ? "is-closed" : ""}`}
              key={cart.cartId}
              onClick={() => navigate(`/cart/${cart.cartId}`)}
              aria-label={`Open cart for ${cart.restaurant?.name}`}
            >
              <span className="cart-group-copy">
                <strong>{cart.restaurant?.name}</strong>
                <span>{meta.join(" · ")}</span>
              </span>
              <ChevronRight aria-hidden="true" size={20} />
            </button>
          );
        })}
      </div>
    </main>
  );
};

export default CartIndex;
