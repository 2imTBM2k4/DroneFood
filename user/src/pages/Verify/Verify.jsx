import { useCallback, useEffect, useContext } from "react";
import "./Verify.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";

const Verify = () => {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success");
  const orderId = searchParams.get("orderId");
  const { url, token } = useContext(StoreContext); // THÊM: token
  const navigate = useNavigate();

  const verifyPayment = useCallback(async () => {
    if (!orderId) {
      toast.error("Invalid order");
      navigate("/");
      return;
    }

    try {
      // Normalize success
      const isSuccess = success === "true";
      const response = await axios.post(
        `${url}/api/order/verify`,
        {
          success: isSuccess, // Boolean
          orderId,
        },
        {
          headers: token ? { token } : {}, // THÊM: Token nếu có
        }
      );
      if (response.data.success) {
        toast.success("Payment verified! Check My Orders.");
        navigate("/myorders");
      } else {
        toast.error("Payment failed");
        navigate("/");
      }
    } catch (error) {
      console.error("Verify error:", error);
      toast.error("Verification error");
      navigate("/");
    }
  }, [navigate, orderId, success, token, url]);

  useEffect(() => {
    if (orderId) {
      verifyPayment();
    }
  }, [orderId, verifyPayment]);

  return (
    <div className="verify">
      <div className="spinner"></div>
      <p>Verifying payment...</p> {/* THÊM: UI feedback */}
    </div>
  );
};

export default Verify;
