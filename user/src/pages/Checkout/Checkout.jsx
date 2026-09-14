import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Check } from "lucide-react";
import "./Checkout.css";
import { StoreContext } from "../../context/StoreContext";
import OrderSummary from "../../components/OrderSummary/OrderSummary";
import LocationPicker from "../../components/LocationPicker/LocationPicker";
import { formatVND } from "../../../../shared/utils/money";

const STEPS = ["Address", "Payment", "Review"];

const emptyAddress = {
  firstName: "",
  lastName: "",
  email: "",
  street: "",
  city: "",
  state: "",
  zipcode: "",
  country: "",
  phone: "",
  lat: null,
  lng: null,
};

// lat/lng come from the map picker, and Vietnam's current admin structure has
// no postal code — so none of these gate the "address complete" check.
const OPTIONAL_FIELDS = new Set(["zipcode"]);
const REQUIRED_FIELDS = Object.keys(emptyAddress).filter(
  (field) => !OPTIONAL_FIELDS.has(field)
);

/**
 * One-page checkout: Address → Payment → Review.
 *
 * The server builds and prices the order from its own copy of the cart, so
 * this page only sends the address and the payment method.
 */
const Checkout = () => {
  const {
    url,
    token,
    user,
    setUser,
    clearCart,
    cartLines,
    isHydrated,
  } = useContext(StoreContext);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState(emptyAddress);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [deliveryMethod, setDeliveryMethod] = useState("shipper");
  const [deliveryQuote, setDeliveryQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [placing, setPlacing] = useState(false);


  // Nothing to check out — send them back to the cart. Wait for hydration
  // first, or a direct visit bounces before the session is restored.
  useEffect(() => {
    if (!isHydrated) return;
    if (!token || cartLines.length === 0) {
      navigate("/cart", { replace: true });
    }
  }, [isHydrated, token, cartLines.length, navigate]);

  // Prefill from the saved profile address, falling back to whatever they
  // typed last time. The recipient name/phone on the saved address win over
  // the account's own name/phone; a user who never saved an address gets the
  // empty form and fills it in here.
  useEffect(() => {
    if (user) {
      const savedFullName = user.address?.fullName || user.name || "";
      const nameParts = savedFullName.trim().split(/\s+/);
      setAddress((current) => ({
        ...current,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: user.email || "",
        phone: user.address?.phone || user.phone || "",
        street: user.address?.address || "",
        city: user.address?.city || "",
        state: user.address?.state || "",
        country: user.address?.country || "",
        zipcode: user.address?.zipCode || "",
        lat: user.address?.lat ?? null,
        lng: user.address?.lng ?? null,
      }));
      return;
    }

    const saved = localStorage.getItem("deliveryInfo");
    if (saved) {
      try {
        setAddress((current) => ({ ...current, ...JSON.parse(saved) }));
      } catch {
        /* stored value is unusable; the empty form is a fine fallback */
      }
    }
  }, [user]);

  const addressComplete = REQUIRED_FIELDS.every((field) =>
    field === "lat" || field === "lng"
      ? Number.isFinite(address[field])
      : Boolean(address[field]?.trim())
  );

  const onAddressChange = (event) => {
    const { name, value } = event.target;
    setAddress((current) => ({ ...current, [name]: value }));
  };

  // Fill the address fields from a point resolved by the map picker. Recipient
  // name/email/phone are kept — only the location parts are overwritten.
  const onLocationResolved = (resolved) => {
    setAddress((current) => ({
      ...current,
      street: resolved.street || current.street,
      city: resolved.city || current.city,
      state: resolved.state || current.state,
      country: resolved.country || current.country,
      zipcode: resolved.zipcode || current.zipcode,
      lat: resolved.lat,
      lng: resolved.lng,
    }));
  };

  // A quote is informational only. The backend repeats this calculation when
  // the order is placed, using its own cart and the selected delivery method.
  useEffect(() => {
    if (!token || !Number.isFinite(address.lat) || !Number.isFinite(address.lng)) {
      setDeliveryQuote(null);
      return;
    }

    let active = true;
    setQuoteError("");
    axios
      .post(
        `${url}/api/order/quote`,
        {
          deliveryMethod,
          address: {
            fullName: `${address.firstName} ${address.lastName}`.trim() || "Customer",
            address: address.street || "Map location",
            city: address.city || "Unknown",
            state: address.state || "Unknown",
            country: address.country || "Vietnam",
            zipCode: address.zipcode,
            phone: address.phone || "0000000000",
            lat: address.lat,
            lng: address.lng,
          },
        },
        { headers: { token } }
      )
      .then((response) => {
        if (active) setDeliveryQuote(response.data.data || null);
      })
      .catch((error) => {
        if (active) {
          setDeliveryQuote(null);
          setQuoteError(error.response?.data?.message || "Unable to calculate delivery fee.");
        }
      });
    return () => {
      active = false;
    };
  }, [address.lat, address.lng, address.firstName, address.lastName, address.street, address.city, address.state, address.country, address.zipcode, address.phone, deliveryMethod, token, url]);

  const persistAddress = async () => {
    localStorage.setItem("deliveryInfo", JSON.stringify(address));
    if (!token || !user) return;

    try {
      // Flat shape expected by PUT /api/user/update-address (and its Joi
      // schema): fullName + phone + address string + city/state/country/zip.
      const payload = {
        fullName: `${address.firstName} ${address.lastName}`.trim(),
        phone: address.phone,
        address: address.street,
        city: address.city,
        state: address.state,
        country: address.country,
        zipCode: address.zipcode,
        lat: address.lat,
        lng: address.lng,
      };
      const response = await fetch(`${url}/api/user/update-address`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      // Server returns the fresh user; sync it so the profile and the live-bar
      // reflect the address entered here without a reload.
      if (result.success && result.data) setUser(result.data);
    } catch (error) {
      // Saving the address to the profile is a convenience, not a blocker.
      console.error("Save address error:", error);
    }
  };

  const submitAddress = async (event) => {
    event.preventDefault();
    await persistAddress();
    setStep(1);
  };

  const placeOrder = useCallback(async () => {
    if (paymentMethod === "COD" && deliveryMethod !== "shipper") {
      toast.error("Cash on delivery is only available with a human shipper.");
      return;
    }
    setPlacing(true);
    try {
      const response = await axios.post(
        `${url}/api/order/place`,
        {
          address: {
            fullName: `${address.firstName} ${address.lastName}`.trim(),
            address: address.street,
            city: address.city,
            state: address.state,
            country: address.country,
            zipCode: address.zipcode,
            phone: address.phone,
            lat: address.lat,
            lng: address.lng,
          },
          paymentMethod,
          deliveryMethod,
        },
        { headers: { token } }
      );

      if (response.data.success) {
        if (paymentMethod === "PAYOS" && response.data.checkoutUrl) {
          window.location.assign(response.data.checkoutUrl);
          return;
        }
        await clearCart();
        toast.success("Order placed successfully!");
        navigate("/myorders");
      } else {
        toast.error(response.data.message || "Error placing order");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Server error. Please try again."
      );
    } finally {
      setPlacing(false);
    }
  }, [address, clearCart, deliveryMethod, navigate, paymentMethod, token, url]);

  const goToStep = (target) => {
    // Never jump forward past a step that isn't satisfied yet.
    if (target > 0 && !addressComplete) return;
    setStep(target);
  };

  if (!isHydrated) {
    return (
      <div className="checkout">
        <div className="skeleton" style={{ height: 44, maxWidth: 340 }} />
        <div className="checkout-body" style={{ marginTop: 26 }}>
          <div className="skeleton" style={{ height: 420 }} />
          <div className="skeleton" style={{ height: 300 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="checkout">
      <nav className="checkout-steps" aria-label="Checkout progress">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`checkout-step ${index === step ? "current" : ""} ${
              index < step ? "done" : ""
            }`}
            onClick={() => goToStep(index)}
            disabled={index > step && !addressComplete}
            aria-current={index === step ? "step" : undefined}
          >
            <span className="checkout-step-mark">
              {index < step ? <Check size={13} strokeWidth={3} /> : index + 1}
            </span>
            {label}
          </button>
        ))}
      </nav>

      <div className="checkout-body">
        <div className="checkout-main">
          {step === 0 && (
            <form className="checkout-panel" onSubmit={submitAddress}>
              <h2>Delivery information</h2>
              <LocationPicker
                initial={
                  address.lat && address.lng
                    ? { lat: address.lat, lng: address.lng }
                    : null
                }
                onResolve={onLocationResolved}
              />
              <div className="checkout-fields">
                <input
                  required
                  name="firstName"
                  value={address.firstName}
                  onChange={onAddressChange}
                  placeholder="First name"
                />
                <input
                  required
                  name="lastName"
                  value={address.lastName}
                  onChange={onAddressChange}
                  placeholder="Last name"
                />
                <input
                  required
                  className="span-2"
                  type="email"
                  name="email"
                  value={address.email}
                  onChange={onAddressChange}
                  placeholder="Email address"
                />
                <input
                  required
                  className="span-2"
                  name="street"
                  value={address.street}
                  onChange={onAddressChange}
                  placeholder="Street"
                />
                <input
                  required
                  name="city"
                  value={address.city}
                  onChange={onAddressChange}
                  placeholder="Province / City"
                />
                <input
                  required
                  name="state"
                  value={address.state}
                  onChange={onAddressChange}
                  placeholder="Ward"
                />
                <input
                  name="zipcode"
                  value={address.zipcode}
                  onChange={onAddressChange}
                  placeholder="Postal code (optional)"
                />
                <input
                  required
                  name="country"
                  value={address.country}
                  onChange={onAddressChange}
                  placeholder="Country"
                />
                <input
                  required
                  className="span-2"
                  name="phone"
                  value={address.phone}
                  onChange={onAddressChange}
                  placeholder="Phone"
                />
              </div>
              <div className="checkout-actions">
                <button type="submit" className="checkout-next">
                  Continue to payment
                </button>
              </div>
            </form>
          )}

          {step === 1 && (
            <div className="checkout-panel">
              <h2>Delivery method</h2>
              <div className="checkout-methods">
                <label className={`checkout-method ${deliveryMethod === "shipper" ? "picked" : ""}`}>
                  <input type="radio" value="shipper" checked={deliveryMethod === "shipper"} onChange={(e) => setDeliveryMethod(e.target.value)} />
                  <span><strong>Shipper</strong><small>5.000đ/km, calculated by road route.</small></span>
                </label>
                <label className={`checkout-method ${deliveryMethod === "drone" ? "picked" : ""}`}>
                  <input type="radio" value="drone" checked={deliveryMethod === "drone"} onChange={(e) => { setDeliveryMethod(e.target.value); if (paymentMethod === "COD") setPaymentMethod("PAYOS"); }} />
                  <span><strong>Drone</strong><small>7.000đ/km, calculated by straight-line distance.</small></span>
                </label>
              </div>
              {deliveryQuote && <p className="checkout-review-block">Delivery: {formatVND(deliveryQuote.shippingPrice)} ({deliveryQuote.billedDistanceKm} km)</p>}
              {quoteError && <p className="checkout-payment-message">{quoteError}</p>}
              <h2>Payment method</h2>
              <div className="checkout-methods">
                <label
                  className={`checkout-method ${
                    paymentMethod === "COD" ? "picked" : ""
                  }`}
                  style={deliveryMethod === "drone" ? { opacity: 0.55 } : undefined}
                >
                  <input
                    type="radio"
                    value="COD"
                    checked={paymentMethod === "COD"}
                    disabled={deliveryMethod === "drone"}
                    onChange={(e) => { setPaymentMethod(e.target.value); setDeliveryMethod("shipper"); }}
                  />
                  <span>
                    <strong>Cash on delivery</strong>
                    <small>Available only with a human shipper.</small>
                  </span>
                </label>
                <label
                  className={`checkout-method ${
                    paymentMethod === "PAYOS" ? "picked" : ""
                  }`}
                >
                  <input
                    type="radio"
                    value="PAYOS"
                    checked={paymentMethod === "PAYOS"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <span>
                    <strong>PayOS</strong>
                    <small>Pay securely by bank card, QR code, or mobile banking.</small>
                  </span>
                </label>
              </div>
              <div className="checkout-actions">
                <button
                  type="button"
                  className="checkout-back"
                  onClick={() => setStep(0)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="checkout-next"
                  onClick={() => setStep(2)}
                  disabled={!deliveryQuote}
                >
                  Review order
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="checkout-panel">
              <h2>Review and confirm</h2>

              <section className="checkout-review-block">
                <div className="checkout-review-head">
                  <span className="ds-label">Delivering to</span>
                  <button type="button" onClick={() => setStep(0)}>
                    Edit
                  </button>
                </div>
                <p>
                  {address.firstName} {address.lastName}
                </p>
                <p>
                  {address.street}, {address.city}, {address.state}{" "}
                  {address.zipcode}, {address.country}
                </p>
                <p>{address.phone}</p>
              </section>

              <section className="checkout-review-block">
                <div className="checkout-review-head">
                  <span className="ds-label">Paying with</span>
                  <button type="button" onClick={() => setStep(1)}>
                    Edit
                  </button>
                </div>
                <p>
                  {paymentMethod === "COD"
                    ? "Cash on delivery"
                    : "PayOS"}
                </p>
              </section>

              <section className="checkout-review-block">
                <p><strong>{deliveryMethod === "shipper" ? "Shipper" : "Drone"}</strong> · {deliveryQuote ? formatVND(deliveryQuote.shippingPrice) : "Calculating…"}</p>
              </section>

              <div className="checkout-actions">
                <button
                  type="button"
                  className="checkout-back"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>

                {paymentMethod === "COD" ? (
                  <button
                    type="button"
                    className="checkout-next"
                    onClick={() => placeOrder()}
                    disabled={placing}
                  >
                    {placing ? "Placing order…" : "Place order"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="checkout-next"
                    onClick={placeOrder}
                    disabled={placing}
                  >
                    {placing ? "Creating payment…" : "Pay with PayOS"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <OrderSummary deliveryQuote={deliveryQuote} />
      </div>
    </div>
  );
};

export default Checkout;
