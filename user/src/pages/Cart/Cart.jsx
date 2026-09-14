import { useState, useContext } from "react";
import "./Cart.css";
import { StoreContext } from "../../context/StoreContext";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ShoppingCart, Store, Trash2, Plus, Minus } from "lucide-react";
import { EmptyState } from "../../../../shared/components/StateBlock";
import ItemOptionsSheet from "../../components/ItemOptionsSheet/ItemOptionsSheet";
import { formatVND } from "../../../../shared/utils/money";

const Cart = () => {
  const {
    cartLines,
    food_list,
    updateLine,
    removeLine,
    getTotalCartAmount,
    fees,
    url,
    token,
    setShowLogin,
    cartRestaurantId,
    restaurant_list,
  } = useContext(StoreContext);
  const navigate = useNavigate();
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [editingLine, setEditingLine] = useState(null);

  const subtotal = getTotalCartAmount();
  const deliveryFee = subtotal > 0 ? fees.deliveryFee : 0;
  const serviceFee = subtotal > 0 ? fees.serviceFee : 0;
  const total = subtotal + deliveryFee + serviceFee;

  // The cart is single-restaurant, so one name heads the whole order.
  const restaurant = restaurant_list.find((r) => r._id === cartRestaurantId);
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);

  const getImageUrl = (line) => {
    if (!line?.image) return "/placeholder.png";
    return line.image.startsWith("http")
      ? line.image
      : `${url}/images/${line.image}`;
  };

  const handleDecrease = (line) => {
    if (line.quantity > 1) {
      updateLine(line.lineKey, line.quantity - 1);
    } else {
      setPendingRemoval(line);
    }
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemoval || isRemoving) return;

    setIsRemoving(true);
    try {
      const removed = await removeLine(pendingRemoval.lineKey);
      if (removed) {
        toast.success("Item removed from cart");
        setPendingRemoval(null);
      }
    } finally {
      setIsRemoving(false);
    }
  };

  const openEditor = (line) => {
    const dish = food_list.find((food) => food._id === line.foodId);
    setEditingLine({
      line,
      item: {
        _id: line.foodId,
        name: line.name,
        price: line.basePrice,
        image: line.image,
        description: dish?.description || "",
        optionGroups: dish?.optionGroups || [],
      },
    });
  };

  const handleProceedCheckout = () => {
    if (!token) {
      toast.error("Please sign in to continue");
      setShowLogin(true);
      return;
    }
    if (cartLines.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    navigate("/checkout");
  };

  return (
    <div className="cart">
      {pendingRemoval && (
        <div className="confirm-dialog-overlay">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-line-title"
            aria-describedby="remove-line-description"
            aria-busy={isRemoving}
          >
            <h3 id="remove-line-title">Confirm removal</h3>
            <p id="remove-line-description">Remove “{pendingRemoval.name}” from your cart?</p>
            <div className="confirm-dialog-buttons">
              <button
                type="button"
                className="confirm-btn"
                onClick={handleConfirmRemove}
                disabled={isRemoving}
              >
                {isRemoving ? "Removing…" : "Yes, remove it"}
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setPendingRemoval(null)}
                disabled={isRemoving}
              >
                No, keep it
              </button>
            </div>
          </div>
        </div>
      )}

      {cartLines.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Add a few dishes and they'll show up here, ready for the drone."
          actionLabel="Browse restaurants"
          onAction={() => navigate("/")}
        />
      ) : (
        <div className="cart-layout">
          <div className="cart-lines">
            <div className="cart-lines-head">
              <h1 className="cart-title">Your order</h1>
              {restaurant && (
                <button
                  type="button"
                  className="cart-restaurant"
                  onClick={() => navigate(`/restaurant/${restaurant._id}`)}
                >
                  <Store size={15} />
                  <span>{restaurant.name}</span>
                </button>
              )}
              <p className="cart-line-count">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </p>
            </div>

            {cartLines.map((line) => (
              <article className="cart-line" key={line.lineKey}>
                <div className="cart-line-image">
                  <img
                    src={getImageUrl(line)}
                    alt={line.name}
                    onError={(e) => {
                      e.target.src = "/placeholder.png";
                    }}
                    loading="lazy"
                  />
                </div>

                <div className="cart-line-main">
                  <p className="cart-line-name">{line.name}</p>
                  {line.selectedOptions.length > 0 && (
                    <p className="cart-item-options">
                      {line.selectedOptions
                        .map((option) => option.optionName)
                        .join(" · ")}
                    </p>
                  )}
                  {line.note && <p className="cart-item-note">“{line.note}”</p>}
                  <p className="cart-line-unit">
                    {formatVND(line.unitPrice)} each
                  </p>
                  <button
                    type="button"
                    className="cart-item-edit"
                    onClick={() => openEditor(line)}
                  >
                    Edit
                  </button>
                </div>

                <div className="cart-line-side">
                  <p className="cart-line-total">
                    {formatVND(line.unitPrice * line.quantity)}
                  </p>
                  <div className="quantity-controls">
                    <button
                      className="quantity-btn decrease"
                      onClick={() => handleDecrease(line)}
                      aria-label={`Decrease quantity of ${line.name}`}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="quantity-display">{line.quantity}</span>
                    <button
                      className="quantity-btn increase"
                      onClick={() => updateLine(line.lineKey, line.quantity + 1)}
                      aria-label={`Increase quantity of ${line.name}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPendingRemoval(line)}
                  className="cart-line-remove"
                  title="Remove item"
                  aria-label={`Remove ${line.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}

            <button
              type="button"
              className="cart-add-more"
              onClick={() =>
                navigate(restaurant ? `/restaurant/${restaurant._id}` : "/restaurants")
              }
            >
              + Add more items
            </button>
          </div>

          <aside className="cart-summary">
            <div className="cart-total">
              <h2>Order summary</h2>
              <div className="cart-total-details">
                <p>Subtotal</p>
                <p className="ds-num">{formatVND(subtotal)}</p>
              </div>
              <div className="cart-total-details">
                <p>Delivery fee</p>
                <p className="ds-num">
                  {deliveryFee == null ? "Calculated at checkout" : formatVND(deliveryFee)}
                </p>
              </div>
              {serviceFee > 0 && (
                <div className="cart-total-details">
                  <p>Service fee</p>
                  <p className="ds-num">{formatVND(serviceFee)}</p>
                </div>
              )}
              <hr />
              <div className="cart-total-details cart-total-grand">
                <b>Total</b>
                <b className="ds-num">{formatVND(total)}</b>
              </div>
              <button className="cart-checkout-btn" onClick={handleProceedCheckout}>
                Proceed to checkout
              </button>
            </div>
          </aside>
        </div>
      )}

      {editingLine && (
        <CartLineEditor
          editing={editingLine}
          onClose={() => setEditingLine(null)}
        />
      )}
    </div>
  );
};

/**
 * Wraps ItemOptionsSheet for editing an existing line. Because a line's
 * identity includes its options, "editing" means removing the old line and
 * adding the new one.
 */
const CartLineEditor = ({ editing, onClose }) => {
  const { addToCart, removeLine } = useContext(StoreContext);

  const handleSubmit = async ({ quantity, selectedOptions, note }) => {
    const removed = await removeLine(editing.line.lineKey);
    if (!removed) return false;

    const added = await addToCart(
      editing.line.foodId,
      quantity,
      selectedOptions,
      note
    );
    if (added) toast.success("Item updated");
    return added;
  };

  return (
    <ItemOptionsSheet
      item={editing.item}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Save changes"
      initial={{
        quantity: editing.line.quantity,
        selectedOptions: editing.line.selectedOptions,
        note: editing.line.note,
      }}
    />
  );
};

export default Cart;
