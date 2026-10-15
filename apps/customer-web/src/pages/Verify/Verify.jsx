import { useEffect, useContext, useRef } from "react";
import "./Verify.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import { verifyPaymentStatus } from "../../utils/paymentVerification";

const Verify = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { token, customerApi, loadCartData, isHydrated } = useContext(StoreContext);
  const refreshCart = useRef(loadCartData);
  refreshCart.current = loadCartData;
  const navigate = useNavigate();

  useEffect(() => {
    if (!isHydrated) return undefined;
    if (!orderId) {
      notificationService.error("Đơn hàng không hợp lệ", "Không tìm thấy thông tin đơn hàng cần xác thực.", { audience: "user", key: "verify-order-invalid" });
      navigate("/", { replace: true });
      return undefined;
    }
    if (!token) {
      notificationService.warning("Phiên đăng nhập đã hết hạn", "Vui lòng đăng nhập lại để xác thực thanh toán đơn hàng này.", { audience: "user", key: `verify-order-auth-${orderId}` });
      navigate("/", { replace: true });
      return undefined;
    }
    const controller = new AbortController();
    const verify = async () => {
      try {
        // Redirect parameters are not evidence of either payment or cancellation.
        const result = await verifyPaymentStatus({ api: customerApi, orderId, signal: controller.signal, attempts: 10 });
        if (result.success) {
          await refreshCart.current();
          if (controller.signal.aborted) return;
          notificationService.success("Đã xác nhận thanh toán", "Vui lòng xem trạng thái xử lý trong đơn hàng.", { audience: "user", key: `verify-paid-${orderId}` });
        } else {
          notificationService.info("Chưa xác nhận thanh toán", result.code === "PAYMENT_CHECK_UNAVAILABLE"
            ? result.message
            : "Nếu đã chuyển khoản, hãy bấm Kiểm tra thanh toán trong đơn hàng. Không cần thanh toán lại.", { audience: "user", key: `verify-confirming-${orderId}` });
        }
        navigate("/myorders", { replace: true });
      } catch (error) {
        if (controller.signal.aborted) return;
        notificationService.error("Chưa thể kiểm tra thanh toán", error.response?.data?.message || "Vui lòng kiểm tra lại từ đơn hàng. Không thanh toán lại nếu bạn đã chuyển khoản.", { audience: "user", key: `verify-order-failure-${orderId}` });
        navigate("/myorders", { replace: true });
      }
    };
    verify();
    return () => controller.abort();
  }, [customerApi, isHydrated, navigate, orderId, token]);

  return (
    <div className="verify" role="status" aria-live="polite">
      <div className="spinner"></div>
      <p className="verify-title">Đang xác thực thanh toán...</p>
      <span className="verify-hint">Vui lòng chờ trong giây lát.</span>
    </div>
  );
};

export default Verify;
