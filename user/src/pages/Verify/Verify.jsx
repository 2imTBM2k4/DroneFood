import { useCallback, useEffect, useContext } from "react";
import "./Verify.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";

const Verify = () => {
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get("status");
  const paymentCancelled = searchParams.get("cancel") === "true" || paymentStatus === "CANCELLED";
  const orderId = searchParams.get("orderId");
  const { url, token, clearCart, isHydrated } = useContext(StoreContext);
  const navigate = useNavigate();

  const verifyPayment = useCallback(async () => {
    if (!orderId) {
      toast.error("Invalid order");
      navigate("/");
      return;
    }
    if (!token) {
      toast.error("Please sign in again to verify this payment.");
      navigate("/");
      return;
    }

    if (paymentCancelled) {
      toast.info("Payment was cancelled. You can retry from your order.");
      navigate("/myorders");
      return;
    }

    try {
      // The redirect can reach the browser a moment before the signed PayOS
      // webhook reaches our server. Poll briefly so a genuine payment never
      // appears as a failure merely because of that race.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await axios.post(
          `${url}/api/order/verify`,
          { orderId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.success) {
          await clearCart();
          toast.success("Payment verified! Check My Orders.");
          navigate("/myorders");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      toast.info("Your payment is still being confirmed. Please check My Orders shortly.");
      navigate("/myorders");
    } catch (error) {
      console.error("Verify error:", error);
      toast.error(error.response?.data?.message || "Verification error");
      navigate("/");
    }
  }, [clearCart, navigate, orderId, paymentCancelled, token, url]);

  useEffect(() => {
    // A payment redirect reloads the SPA. Wait until StoreContext has restored
    // the saved access token, otherwise this request races with hydration and
    // receives a 401 from the protected verification endpoint.
    if (isHydrated && orderId) {
      verifyPayment();
    }
  }, [isHydrated, orderId, verifyPayment]);

  return (
    <div className="verify">
      <div className="spinner"></div>
      <p>{paymentCancelled ? "Payment was cancelled." : "Verifying payment..."}</p>
    </div>
  );
};

export default Verify;
