import { useCallback, useEffect, useContext } from "react";
import "./Verify.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";

const Verify = () => {
  const [searchParams] = useSearchParams();
  const vnpayResult = searchParams.get("vnpay");
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

    try {
      const response = await axios.post(
        `${url}/api/order/verify`,
        { orderId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        await clearCart();
        toast.success("Payment verified! Check My Orders.");
        navigate("/myorders");
      } else {
        toast.error("Payment failed");
        navigate("/");
      }
    } catch (error) {
      console.error("Verify error:", error);
      toast.error(error.response?.data?.message || "Verification error");
      navigate("/");
    }
  }, [clearCart, navigate, orderId, token, url]);

  useEffect(() => {
    // A VNPay redirect reloads the SPA. Wait until StoreContext has restored
    // the saved access token, otherwise this request races with hydration and
    // receives a 401 from the protected verification endpoint.
    if (isHydrated && orderId) {
      verifyPayment();
    }
  }, [isHydrated, orderId, verifyPayment]);

  return (
    <div className="verify">
      <div className="spinner"></div>
      <p>{vnpayResult === "failed" ? "Payment was not completed." : "Verifying payment..."}</p>
    </div>
  );
};

export default Verify;
