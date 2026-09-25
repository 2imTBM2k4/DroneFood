import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { toast } from "react-toastify";
import "./Checkout.css";
import { StoreContext } from "../../context/StoreContext";
import OrderSummary from "../../components/OrderSummary/OrderSummary";
import AddressFormModal from "../../components/AddressFormModal/AddressFormModal";
import { emptyDeliveryAddress } from "../../components/AddressFormModal/addressFormModel";
import { formatVND } from "../../../../shared/utils/money";

const STEPS = ["Address", "Payment", "Review"];
const toShippingAddress = (entry, fullName) => ({
  fullName: fullName || entry.recipient || "Customer",
  phone: entry.phone || "",
  address: entry.address || "",
  city: entry.city || "",
  state: entry.state || "",
  country: entry.country || "Việt Nam",
  zipCode: entry.zipCode || "",
  lat: entry.lat ?? null,
  lng: entry.lng ?? null,
});
const isComplete = (address) =>
  ["fullName", "phone", "address", "city", "state", "country"].every((key) =>
    Boolean(address[key]?.trim())
  ) &&
  Number.isFinite(address.lat) &&
  Number.isFinite(address.lng);

const Checkout = () => {
  const {
    token,
    customerApi,
    user,
    setUser,
    clearCart,
    cartLines,
    isHydrated,
    activeAddressId,
    setActiveAddressId,
  } = useContext(StoreContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [oneTimeAddress, setOneTimeAddress] = useState(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState("shipper");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [deliveryQuote, setDeliveryQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucherCodes, setAppliedVoucherCodes] = useState([]);
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (isHydrated && (!token || cartLines.length === 0)) {
      navigate("/cart", { replace: true });
    }
  }, [cartLines.length, isHydrated, navigate, token]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    customerApi
      .get("/api/address-book")
      .then((response) => {
        if (!active) return;
        const entries = response.data.data || [];
        setSavedAddresses(entries);
        setUser((current) =>
          current ? { ...current, addressBook: entries } : current
        );
        const preferred =
          entries.find((entry) => entry.id === activeAddressId) ||
          entries.find((entry) => entry.isDefault) ||
          entries[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          setActiveAddressId(preferred.id);
        }
      })
      .catch(() => {
        if (active) setSavedAddresses([]);
      });
    return () => {
      active = false;
    };
  }, [activeAddressId, customerApi, setActiveAddressId, setUser, token]);

  const selectedEntry = savedAddresses.find(
    (entry) => entry.id === selectedAddressId
  );
  const address = useMemo(
    () =>
      oneTimeAddress ||
      (selectedEntry ? toShippingAddress(selectedEntry, user?.name) : null),
    [oneTimeAddress, selectedEntry, user?.name]
  );

  useEffect(() => {
    if (!address || !isComplete(address) || !token) {
      setDeliveryQuote(null);
      return undefined;
    }
    let active = true;
    setQuoteError("");
    const quotePayload = {
      deliveryMethod,
      voucherCodes: appliedVoucherCodes,
      ...(selectedAddressId && !oneTimeAddress
        ? { addressEntryId: selectedAddressId }
        : { address }),
    };

    customerApi
      .post("/api/order/quote", quotePayload)
      .then((response) => {
        if (active) setDeliveryQuote(response.data.data || null);
      })
      .catch((error) => {
        if (!active) return;
        const message =
          error.response?.data?.message || "Unable to calculate delivery fee.";
        if (appliedVoucherCodes.length > 0) {
          setAppliedVoucherCodes([]);
          setVoucherError(message);
        } else {
          setDeliveryQuote(null);
          setQuoteError(message);
        }
      });
    return () => {
      active = false;
    };
  }, [
    address,
    appliedVoucherCodes,
    customerApi,
    deliveryMethod,
    oneTimeAddress,
    selectedAddressId,
    token,
  ]);

  const selectSaved = (entry) => {
    setOneTimeAddress(null);
    setSelectedAddressId(entry.id);
    setActiveAddressId(entry.id);
  };

  const useOneTimeAddress = (form) => {
    setOneTimeAddress({
      ...toShippingAddress(form, user?.name),
      zipCode: form.zipCode || "",
    });
    setSelectedAddressId("");
    setAddressModalOpen(false);
  };

  const handleAddVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;
    if (appliedVoucherCodes.includes(code)) {
      setVoucherError("Mã giảm giá này đã được thêm.");
      return;
    }
    const nextCodes = [...appliedVoucherCodes, code];
    setApplyingVoucher(true);
    setVoucherError("");
    try {
      const quotePayload = {
        deliveryMethod,
        voucherCodes: nextCodes,
        ...(selectedAddressId && !oneTimeAddress
          ? { addressEntryId: selectedAddressId }
          : { address }),
      };
      const response = await customerApi.post("/api/order/quote", quotePayload);
      setDeliveryQuote(response.data.data || null);
      setAppliedVoucherCodes(nextCodes);
      setVoucherInput("");
      setVoucherError("");
    } catch (error) {
      const message =
        error.response?.data?.message || "Không thể áp dụng mã voucher này.";
      setVoucherError(message);
    } finally {
      setApplyingVoucher(false);
    }
  };

  const handleRemoveVoucher = (codeToRemove) => {
    setAppliedVoucherCodes((prev) => prev.filter((c) => c !== codeToRemove));
    setVoucherError("");
  };

  const placeOrder = useCallback(async () => {
    if (!address || !isComplete(address)) return;
    if (paymentMethod === "COD" && deliveryMethod !== "shipper") {
      toast.error("Cash on delivery is only available with a human shipper.");
      return;
    }
    setPlacing(true);
    try {
      const payload = {
        ...(selectedAddressId && !oneTimeAddress
          ? { addressEntryId: selectedAddressId }
          : { address }),
        paymentMethod,
        deliveryMethod,
        voucherCodes: appliedVoucherCodes,
      };
      const response = await customerApi.post("/api/order/place", payload);
      if (!response.data.success) {
        throw new Error(response.data.message || "Error placing order");
      }
      if (paymentMethod === "PAYOS" && response.data.checkoutUrl) {
        window.location.assign(response.data.checkoutUrl);
        return;
      }
      await clearCart();
      toast.success("Order placed successfully!");
      navigate("/myorders");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Server error. Please try again."
      );
    } finally {
      setPlacing(false);
    }
  }, [
    address,
    appliedVoucherCodes,
    clearCart,
    customerApi,
    deliveryMethod,
    navigate,
    oneTimeAddress,
    paymentMethod,
    selectedAddressId,
  ]);

  const canContinueAddress = Boolean(address && isComplete(address));
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
            onClick={() => {
              if (index <= step || canContinueAddress) setStep(index);
            }}
            disabled={index > step && !canContinueAddress}
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
            <section className="checkout-panel">
              <h2>Delivery information</h2>
              <p className="checkout-lead">
                Select a saved address, or use a different address for this order only.
              </p>
              <section
                className="checkout-saved-addresses"
                aria-labelledby="saved-addresses-title"
              >
                <div>
                  <h3 id="saved-addresses-title">Saved addresses</h3>
                  <p>Fullname is taken from your profile.</p>
                </div>
                {savedAddresses.length ? (
                  <div className="checkout-address-options">
                    {savedAddresses.map((entry) => (
                      <label
                        key={entry.id}
                        className={`checkout-address-option ${
                          selectedAddressId === entry.id && !oneTimeAddress
                            ? "selected"
                            : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="saved-address"
                          checked={
                            selectedAddressId === entry.id && !oneTimeAddress
                          }
                          onChange={() => selectSaved(entry)}
                        />
                        <span>
                          <strong>
                            {entry.label}
                            {entry.isDefault ? " · Default" : ""}
                          </strong>
                          <small>
                            {user?.name || entry.recipient} · {entry.address},{" "}
                            {entry.city}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="checkout-empty-address">No saved address yet.</p>
                )}
              </section>

              <button
                type="button"
                className="checkout-other-address"
                onClick={() => setAddressModalOpen(true)}
              >
                Choose a different address
              </button>

              {oneTimeAddress && (
                <div className="checkout-one-time-address">
                  <div>
                    <strong>One-time address</strong>
                    <p>
                      {oneTimeAddress.address}, {oneTimeAddress.city}
                    </p>
                    <small>
                      This address will not be saved to your address book.
                    </small>
                  </div>
                </div>
              )}

              <div className="checkout-actions">
                <button
                  type="button"
                  className="checkout-next"
                  onClick={() => setStep(1)}
                  disabled={!canContinueAddress}
                >
                  Continue to payment
                </button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="checkout-panel">
              <h2>Delivery method</h2>
              <div className="checkout-methods">
                <label
                  className={`checkout-method ${
                    deliveryMethod === "shipper" ? "picked" : ""
                  }`}
                >
                  <input
                    type="radio"
                    value="shipper"
                    checked={deliveryMethod === "shipper"}
                    onChange={(event) => setDeliveryMethod(event.target.value)}
                  />
                  <span>
                    <strong>Shipper</strong>
                    <small>Calculated by road route.</small>
                  </span>
                </label>
                <label
                  className={`checkout-method ${
                    deliveryMethod === "drone" ? "picked" : ""
                  }`}
                >
                  <input
                    type="radio"
                    value="drone"
                    checked={deliveryMethod === "drone"}
                    onChange={(event) => {
                      setDeliveryMethod(event.target.value);
                      if (paymentMethod === "COD") setPaymentMethod("PAYOS");
                    }}
                  />
                  <span>
                    <strong>Drone</strong>
                    <small>Calculated by flight route.</small>
                  </span>
                </label>
              </div>

              {deliveryQuote && (
                <p className="checkout-review-block">
                  Delivery: {formatVND(deliveryQuote.shippingPrice)} (
                  {deliveryQuote.billedDistanceKm} km)
                </p>
              )}
              {quoteError && (
                <p className="checkout-payment-message" role="alert">
                  {quoteError}
                </p>
              )}

              <h2>Payment method</h2>
              <div className="checkout-methods">
                <label
                  className={`checkout-method ${
                    paymentMethod === "COD" ? "picked" : ""
                  }`}
                >
                  <input
                    type="radio"
                    value="COD"
                    checked={paymentMethod === "COD"}
                    disabled={deliveryMethod === "drone"}
                    onChange={() => {
                      setPaymentMethod("COD");
                      setDeliveryMethod("shipper");
                    }}
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
                    onChange={() => setPaymentMethod("PAYOS")}
                  />
                  <span>
                    <strong>PayOS</strong>
                    <small>
                      Pay securely by bank card, QR code, or mobile banking.
                    </small>
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
            </section>
          )}

          {step === 2 && (
            <section className="checkout-panel">
              <h2>Review and confirm</h2>
              <section className="checkout-review-block">
                <div className="checkout-review-head">
                  <span className="ds-label">Delivering to</span>
                  <button type="button" onClick={() => setStep(0)}>
                    Edit
                  </button>
                </div>
                <p>{address?.fullName}</p>
                <p>
                  {address?.address}, {address?.city}, {address?.state}{" "}
                  {address?.zipCode}, {address?.country}
                </p>
                <p>{address?.phone}</p>
              </section>

              <section className="checkout-review-block">
                <div className="checkout-review-head">
                  <span className="ds-label">Paying with</span>
                  <button type="button" onClick={() => setStep(1)}>
                    Edit
                  </button>
                </div>
                <p>
                  {paymentMethod === "COD" ? "Cash on delivery" : "PayOS"}
                </p>
              </section>

              <section className="checkout-review-block">
                <p>
                  <strong>
                    {deliveryMethod === "shipper" ? "Shipper" : "Drone"}
                  </strong>{" "}
                  ·{" "}
                  {deliveryQuote
                    ? formatVND(deliveryQuote.shippingPrice)
                    : "Calculating…"}
                </p>
              </section>

              <section className="checkout-review-block checkout-voucher">
                <label htmlFor="voucher-code">Mã giảm giá (Có thể dùng nhiều mã)</label>
                <div className="checkout-voucher-control">
                  <input
                    id="voucher-code"
                    value={voucherInput}
                    onChange={(event) => {
                      setVoucherInput(event.target.value.toUpperCase());
                      setVoucherError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddVoucher();
                      }
                    }}
                    placeholder="Nhập mã (VD: FOOD10, FREESHIP)"
                    autoCapitalize="characters"
                    aria-invalid={Boolean(voucherError)}
                    aria-describedby={
                      voucherError ? "voucher-code-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={handleAddVoucher}
                    disabled={!voucherInput.trim() || applyingVoucher}
                  >
                    {applyingVoucher ? "Đang kiểm tra…" : "Áp dụng"}
                  </button>
                </div>

                {voucherError && (
                  <p
                    id="voucher-code-error"
                    className="checkout-voucher-error"
                    role="alert"
                  >
                    {voucherError}
                  </p>
                )}

                {appliedVoucherCodes.length > 0 && (
                  <div
                    className="checkout-applied-vouchers"
                    aria-label="Mã giảm giá đã áp dụng"
                  >
                    {appliedVoucherCodes.map((code) => {
                      const snap =
                        deliveryQuote?.vouchers?.find((v) => v.code === code) ||
                        (deliveryQuote?.voucher?.code === code
                          ? deliveryQuote.voucher
                          : null);
                      return (
                        <div key={code} className="checkout-voucher-chip">
                          <span className="checkout-voucher-chip-code">
                            {code}
                          </span>
                          {snap && (
                            <span className="checkout-voucher-chip-desc">
                              {snap.appliesTo === "shipping_fee"
                                ? "Giảm ship"
                                : "Giảm món"}{" "}
                              (-{formatVND(snap.discountAmount)})
                            </span>
                          )}
                          <button
                            type="button"
                            className="checkout-voucher-chip-remove"
                            onClick={() => handleRemoveVoucher(code)}
                            title={`Xoá mã ${code}`}
                            aria-label={`Xoá mã ${code}`}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {deliveryQuote?.discountAmount > 0 && (
                  <p className="checkout-voucher-success">
                    Tổng giảm: -{formatVND(deliveryQuote.discountAmount)}
                  </p>
                )}
              </section>

              <div className="checkout-actions">
                <button
                  type="button"
                  className="checkout-back"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="checkout-next"
                  onClick={placeOrder}
                  disabled={placing}
                >
                  {placing
                    ? paymentMethod === "PAYOS"
                      ? "Creating payment…"
                      : "Placing order…"
                    : paymentMethod === "PAYOS"
                    ? "Pay with PayOS"
                    : "Place order"}
                </button>
              </div>
            </section>
          )}
        </div>
        <OrderSummary deliveryQuote={deliveryQuote} />
      </div>
      <AddressFormModal
        open={addressModalOpen}
        title="Use a different address"
        description="This address is used for this order only and will not be saved."
        initial={oneTimeAddress || emptyDeliveryAddress}
        fullName={user?.name}
        submitLabel="Use this address"
        onClose={() => setAddressModalOpen(false)}
        onSubmit={useOneTimeAddress}
      />
    </div>
  );
};

export default Checkout;

