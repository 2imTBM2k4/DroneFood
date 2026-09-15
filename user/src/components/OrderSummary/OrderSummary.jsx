import { useContext, useState } from "react";
import { ChevronUp } from "lucide-react";
import "./OrderSummary.css";
import { StoreContext } from "../../context/StoreContext";
import { formatVND } from "../../../../shared/utils/money";

/**
 * The running cost of the order: lines, then every fee spelled out.
 *
 * Sticky beside the checkout on desktop; on mobile it collapses to a bar at
 * the bottom that expands on tap. Fees come from the server (GET
 * /api/config/fees) so what's shown here is what gets charged.
 */
const OrderSummary = ({ collapsible = true, deliveryQuote = null }) => {
  const { cartLines, getTotalCartAmount, fees } = useContext(StoreContext);
  const [expanded, setExpanded] = useState(false);

  const subtotal = getTotalCartAmount();
  const deliveryFee = subtotal > 0 ? deliveryQuote?.shippingPrice ?? fees.deliveryFee : 0;
  const serviceFee = subtotal > 0 ? fees.serviceFee : 0;
  // Voucher calculation is returned by the server quote. Never derive the
  // discount from the typed code on the client: an expired/invalid code must
  // not temporarily make the total look cheaper.
  const discountAmount = subtotal > 0 ? deliveryQuote?.discountAmount ?? 0 : 0;
  const total = Math.max(0, subtotal + deliveryFee + serviceFee - discountAmount);
  const voucherCode = deliveryQuote?.voucher?.code;

  return (
    <aside
      className={`order-summary ${collapsible ? "collapsible" : ""} ${
        expanded ? "expanded" : ""
      }`}
    >
      {collapsible && (
        <button
          type="button"
          className="order-summary-toggle"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          <span>{expanded ? "Hide" : "Show"} order details</span>
          <span className="order-summary-toggle-right">
            <span className="ds-num">{formatVND(total)}</span>
            <ChevronUp size={16} className="order-summary-chevron" />
          </span>
        </button>
      )}

      <div className="order-summary-panel">
        <h3 className="order-summary-title">Order summary</h3>

        <ul className="order-summary-lines">
          {cartLines.map((line) => (
            <li key={line.lineKey} className="order-summary-line">
              <span className="order-summary-qty ds-num">{line.quantity}×</span>
              <span className="order-summary-line-body">
                <span className="order-summary-name">{line.name}</span>
                {line.selectedOptions.length > 0 && (
                  <span className="order-summary-options">
                    {line.selectedOptions
                      .map((option) => option.optionName)
                      .join(" · ")}
                  </span>
                )}
                {line.note && (
                  <span className="order-summary-note">“{line.note}”</span>
                )}
              </span>
              <span className="order-summary-amount ds-num">
                {formatVND(line.unitPrice * line.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="order-summary-fees">
          <div className="order-summary-row">
            <span>Subtotal</span>
            <span className="ds-num">{formatVND(subtotal)}</span>
          </div>
          <div className="order-summary-row">
            <span>Delivery fee</span>
            <span className="ds-num">
              {deliveryFee == null ? "Calculated at checkout" : formatVND(deliveryFee)}
            </span>
          </div>
          {serviceFee > 0 && (
            <div className="order-summary-row">
              <span>Service fee</span>
              <span className="ds-num">{formatVND(serviceFee)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="order-summary-row order-summary-discount" aria-live="polite">
              <span>{voucherCode ? `Voucher ${voucherCode}` : "Voucher"}</span>
              <span className="ds-num">-{formatVND(discountAmount)}</span>
            </div>
          )}
          <div className="order-summary-row order-summary-total">
            <span>Total</span>
            <span className="ds-num" aria-live="polite">{formatVND(total)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default OrderSummary;
