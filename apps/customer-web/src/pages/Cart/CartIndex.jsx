import { useContext, useEffect, useState } from "react";
import { ChevronRight, ShoppingCart, Store, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { EmptyState } from "@drone-food/web-ui/components/StateBlock";
import { StoreContext } from "../../context/StoreContext";
import { cartMeta } from "../../lib/cartState";
import "./Cart.css";

const restaurantImageUrl = (url, image) => {
  if (!image) return "";
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  const clean = image.replace(/^\/+/, "");
  return clean.startsWith("images/") ? `${url}/${clean}` : `${url}/images/${clean}`;
};

const CartIndex = () => {
  const { cartSummaries, clearCarts, isHydrated, restaurant_list, url } = useContext(StoreContext);
  const navigate = useNavigate();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCartIds, setSelectedCartIds] = useState(() => new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const availableIds = new Set(cartSummaries.map((cart) => cart.cartId));
    setSelectedCartIds((current) => new Set(
      [...current].filter((cartId) => availableIds.has(cartId))
    ));
  }, [cartSummaries]);

  const stopSelecting = () => {
    setSelectionMode(false);
    setSelectedCartIds(new Set());
  };

  const toggleCart = (cartId) => {
    setSelectedCartIds((current) => {
      const next = new Set(current);
      if (next.has(cartId)) next.delete(cartId);
      else next.add(cartId);
      return next;
    });
  };

  const allSelected = cartSummaries.length > 0 && selectedCartIds.size === cartSummaries.length;
  const toggleAll = () => {
    setSelectedCartIds(allSelected
      ? new Set()
      : new Set(cartSummaries.map((cart) => cart.cartId)));
  };

  const handleDeleteSelected = async () => {
    if (selectedCartIds.size === 0 || isDeleting) return;
    setIsDeleting(true);
    try {
      const { clearedIds, failedIds } = await clearCarts([...selectedCartIds]);
      if (clearedIds.length > 0) {
        toast.success(`${clearedIds.length} ${clearedIds.length === 1 ? "cart" : "carts"} removed`);
      }
      if (failedIds.length > 0) {
        toast.error(`Could not remove ${failedIds.length} ${failedIds.length === 1 ? "cart" : "carts"}. Please try again.`);
        setSelectedCartIds(new Set(failedIds));
      } else {
        stopSelecting();
      }
      setConfirmDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

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
    <>
      {confirmDeleteOpen && (
        <div className="confirm-dialog-overlay">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-carts-title"
            aria-describedby="remove-carts-description"
            aria-busy={isDeleting}
          >
            <h3 id="remove-carts-title">Remove selected carts?</h3>
            <p id="remove-carts-description">
              This will remove {selectedCartIds.size} restaurant {selectedCartIds.size === 1 ? "cart" : "carts"} and every item inside.
            </p>
            <div className="confirm-dialog-buttons">
              <button type="button" className="confirm-btn" onClick={handleDeleteSelected} disabled={isDeleting}>
                {isDeleting ? "Removing…" : "Remove carts"}
              </button>
              <button type="button" className="cancel-btn" onClick={() => setConfirmDeleteOpen(false)} disabled={isDeleting}>
                Keep carts
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="cart cart-index">
      <div className="cart-index-head">
        <div>
          <h1 className="cart-title">Your carts</h1>
          <p>{cartSummaries.length} {cartSummaries.length === 1 ? "restaurant" : "restaurants"}</p>
        </div>
        <button
          type="button"
          className="cart-selection-toggle"
          onClick={() => (selectionMode ? stopSelecting() : setSelectionMode(true))}
          aria-pressed={selectionMode}
        >
          {selectionMode ? "Cancel" : "Select"}
        </button>
      </div>

      {selectionMode && (
        <div className="cart-bulk-toolbar" aria-label="Cart selection actions">
          <button type="button" className="cart-select-all" onClick={toggleAll}>
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="cart-selected-count" role="status" aria-live="polite">
            {selectedCartIds.size} selected
          </span>
          <button
            type="button"
            className="cart-delete-selected"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={selectedCartIds.size === 0 || isDeleting}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete selected
          </button>
        </div>
      )}

      <div className="cart-group-list">
        {cartSummaries.map((cart) => {
          const meta = cartMeta(cart);
          const restaurantImage = cart.restaurant?.image
            || restaurant_list.find((restaurant) => String(restaurant._id) === String(cart.restaurant?.id))?.image
            || "";
          const selected = selectedCartIds.has(cart.cartId);
          return (
            <article
              className={`cart-group-row ${selectionMode ? "is-selecting" : ""} ${selected ? "is-selected" : ""}`}
              key={cart.cartId}
            >
              {selectionMode && (
                <label className="cart-group-check">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleCart(cart.cartId)}
                    aria-label={`Select cart for ${cart.restaurant?.name}`}
                  />
                </label>
              )}
            <button
              type="button"
              className={`cart-group-card ${cart.restaurant?.isOpen === false ? "is-closed" : ""}`}
              onClick={() => navigate(`/cart/${cart.cartId}`)}
              aria-label={`Open cart for ${cart.restaurant?.name}`}
            >
              <span className="cart-group-main">
                {restaurantImage ? (
                  <img
                    className="cart-restaurant-avatar cart-restaurant-avatar-lg"
                    src={restaurantImageUrl(url, restaurantImage)}
                    alt={`Ảnh cửa hàng ${cart.restaurant.name}`}
                    loading="lazy"
                    onError={(event) => { event.currentTarget.src = "/placeholder.png"; }}
                  />
                ) : (
                  <span className="cart-restaurant-avatar cart-restaurant-avatar-lg cart-restaurant-avatar-fallback" aria-hidden="true">
                    <Store size={24} />
                  </span>
                )}
                <span className="cart-group-copy">
                  <strong>{cart.restaurant?.name}</strong>
                  <span>{meta.join(" · ")}</span>
                </span>
              </span>
              <ChevronRight aria-hidden="true" size={20} />
            </button>
            </article>
          );
        })}
      </div>
      </main>
    </>
  );
};

export default CartIndex;
