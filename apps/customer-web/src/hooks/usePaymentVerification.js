import { useContext, useEffect, useRef, useState } from "react";
import { StoreContext } from "../context/StoreContext";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import { verifyPaymentStatus } from "../utils/paymentVerification";

/** Shares a cancellable manual check between the order list and order detail. */
export const usePaymentVerification = (onRefresh, scope = "orders") => {
  const { customerApi, token, loadCartData } = useContext(StoreContext);
  const [checkingOrderId, setCheckingOrderId] = useState(null);
  const active = useRef(null);
  const latest = useRef({ loadCartData, onRefresh });
  latest.current = { loadCartData, onRefresh };

  useEffect(() => {
    setCheckingOrderId(null);
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, [customerApi, scope, token]);

  const checkPayment = async (orderId) => {
    if (active.current || !token) return;
    const controller = new AbortController();
    active.current = controller;
    setCheckingOrderId(orderId);
    try {
      const result = await verifyPaymentStatus({ api: customerApi, orderId, signal: controller.signal });
      if (result.success) {
        notificationService.success("Đã xác nhận thanh toán", "Vui lòng xem trạng thái xử lý trong đơn hàng.", { audience: "user", key: `payment-check-${orderId}` });
        await latest.current.loadCartData();
      } else {
        notificationService.info("Chưa xác nhận thanh toán", result.code === "PAYMENT_CHECK_UNAVAILABLE"
          ? result.message
          : "Nếu đã chuyển khoản, vui lòng chờ rồi kiểm tra lại. Không cần thanh toán lại.", { audience: "user", key: `payment-check-${orderId}` });
      }
      if (!controller.signal.aborted) await latest.current.onRefresh();
    } catch (error) {
      if (!controller.signal.aborted) {
        notificationService.error("Chưa thể kiểm tra thanh toán", error.response?.data?.message || "Vui lòng thử lại. Không thanh toán lại nếu đã chuyển khoản.", { audience: "user", key: `payment-check-${orderId}` });
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setCheckingOrderId(null);
      }
    }
  };

  return { checkPayment, checkingOrderId };
};
