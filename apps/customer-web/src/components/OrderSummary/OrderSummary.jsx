import { useContext, useState } from "react";
import { ChevronUp, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import "./OrderSummary.css";
import { StoreContext } from "../../context/StoreContext";
import { formatVND } from "@drone-food/web-ui/utils/money";

/**
 * The running cost of the order: lines, then every fee spelled out.
 *
 * Sticky beside the checkout on desktop; on mobile it collapses to a bar at
 * the bottom that expands on tap. Fees come from the server (GET
 * /api/config/fees) so what's shown here is what gets charged.
 */
const OrderSummary = ({
  cart,
  collapsible = true,
  deliveryQuote = null,
  onUpdateQuantity,
  onCustomizeLine,
  updatingLineKey = "",
}) => {
  const { fees, url } = useContext(StoreContext);
  const cartLines = cart?.items || [];
  const [expanded, setExpanded] = useState(false);

  const subtotal = cart?.subtotal || 0;
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
          {cartLines.map((line) => {
            const imageSrc = line.image?.startsWith("http") ? line.image : line.image ? `${url}/images/${line.image}` : null;
            const updating = updatingLineKey === line.lineKey;
            return (
              <li key={line.lineKey} className="order-summary-line">
                {imageSrc ? <img className="order-summary-image" src={imageSrc} alt={line.name} loading="lazy" /> : <span className="order-summary-image-fallback" aria-hidden="true" />}
                <span className="order-summary-line-body">
                  <span className="order-summary-name">{line.name}</span>
                  {line.selectedOptions.length > 0 && (
                    <span className="order-summary-options">
                      {line.selectedOptions.map((option) => option.optionName).join(" · ")}
                    </span>
                  )}
                  {line.note && <span className="order-summary-note">“{line.note}”</span>}
                  {onCustomizeLine && <button type="button" className="order-summary-customize" onClick={() => onCustomizeLine(line)} disabled={Boolean(updatingLineKey)}><Pencil size={13} /> Tùy chỉnh</button>}
                </span>
                <span className="order-summary-side">
                  <span className="order-summary-amount ds-num">{formatVND(line.unitPrice * line.quantity)}</span>
                  {onUpdateQuantity && <span className="order-summary-controls" aria-busy={updating}>
                    <button type="button" onClick={() => onUpdateQuantity(line, line.quantity - 1)} disabled={Boolean(updatingLineKey)} aria-label={line.quantity === 1 ? `Xóa ${line.name}` : `Giảm số lượng ${line.name}`}>{line.quantity === 1 ? <Trash2 size={15} /> : <Minus size={15} />}</button>
                    <span aria-label={`Số lượng ${line.name}: ${line.quantity}`}>{line.quantity}</span>
                    <button type="button" onClick={() => onUpdateQuantity(line, line.quantity + 1)} disabled={Boolean(updatingLineKey)} aria-label={`Tăng số lượng ${line.name}`}><Plus size={15} /></button>
                  </span>}
                </span>
              </li>
            );
          })}
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
              <span>
                {deliveryQuote?.vouchers?.length > 1
                  ? `Voucher (${deliveryQuote.vouchers.map((v) => v.code).join(" + ")})`
                  : voucherCode
                  ? `Voucher ${voucherCode}`
                  : "Voucher"}
              </span>
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
