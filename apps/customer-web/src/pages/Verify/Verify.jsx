import { useCallback, useEffect, useContext } from "react";
import "./Verify.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";

const Verify = () => {
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get("status");
  const paymentCancelled = searchParams.get("cancel") === "true" || paymentStatus === "CANCELLED";
  const orderId = searchParams.get("orderId");
  const { url, token, loadCartData, isHydrated } = useContext(StoreContext);
  const navigate = useNavigate();

  const verifyPayment = useCallback(async () => {
    if (!orderId) {
      notificationService.error(
        "Đơn hàng không hợp lệ",
        "Không tìm thấy thông tin đơn hàng cần xác thực.",
        { audience: "user", key: "verify-order-invalid" }
      );
      navigate("/");
      return;
    }
    if (!token) {
      notificationService.warning(
        "Phiên đăng nhập đã hết hạn",
        "Vui lòng đăng nhập lại để xác thực thanh toán đơn hàng này.",
        { audience: "user", key: `verify-order-auth-${orderId}` }
      );
      navigate("/");
      return;
    }

    if (paymentCancelled) {
      notificationService.info(
        "Thanh toán đã bị hủy",
        "Bạn có thể thanh toán lại từ danh sách đơn hàng của mình.",
        { audience: "user", key: `verify-cancel-${orderId}` }
      );
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
          await loadCartData();
          notificationService.success("Thanh toán thành công!", "Giao dịch đã được xác thực. Vui lòng kiểm tra đơn hàng.", { audience: "user" });
          navigate("/myorders");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      notificationService.info(
        "Đang chờ xác nhận thanh toán",
        "Giao dịch của bạn đang được hệ thống xử lý. Vui lòng kiểm tra lại đơn hàng sau ít phút.",
        { audience: "user", key: `verify-confirming-${orderId}` }
      );
      navigate("/myorders");
    } catch (error) {
      console.error("Verify error:", error);
      notificationService.error(
        "Xác thực thanh toán thất bại",
        error.response?.data?.message || "Không thể xác thực giao dịch vào lúc này. Vui lòng kiểm tra lại đơn hàng.",
        {
          audience: "user",
          priority: "high",
          persistent: true,
          duration: 0,
          key: `verify-order-failure-${orderId}`,
          actions: [{ label: "Thử lại", onClick: verifyPayment }],
        }
      );
      navigate("/");
    }
  }, [loadCartData, navigate, orderId, paymentCancelled, token, url]);

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
      <p className="verify-title">
        {paymentCancelled ? "Thanh toán đã bị hủy" : "Đang xác thực thanh toán..."}
      </p>
      <span className="verify-hint">
        {paymentCancelled
          ? "Đang chuyển hướng về danh sách đơn hàng..."
          : "Verifying payment... Vui lòng chờ trong giây lát."}
      </span>
    </div>
  );
};

export default Verify;
