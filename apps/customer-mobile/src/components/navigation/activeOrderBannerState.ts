import type { Order, ScreenName } from "../../types";

const ACTIVE_ORDER_STATUSES: Order["orderStatus"][] = [
  "preparing",
  "delivering",
  "arrived_at_delivery",
];

export const shouldShowActiveOrderBanner = (
  screen: ScreenName,
  orderStatus?: Order["orderStatus"]
) => screen === "home" && Boolean(orderStatus && ACTIVE_ORDER_STATUSES.includes(orderStatus));

export const floatingSurfaceForScreen = (
  screen: ScreenName,
  hasActiveOrder: boolean,
  hasRestaurantCart: boolean
): "active-order" | "restaurant-cart" | null => {
  if (screen === "home") return hasActiveOrder ? "active-order" : null;
  if (screen === "restaurant") return hasRestaurantCart ? "restaurant-cart" : null;
  return null;
};

interface ActiveOrderBannerContentInput {
  orderId: string;
  orderStatus: Order["orderStatus"];
  deliveryMethod: Order["deliveryMethod"];
}

export const buildActiveOrderBannerContent = ({
  orderId,
  orderStatus,
  deliveryMethod,
}: ActiveOrderBannerContentInput) => {
  const isDrone = deliveryMethod === "drone";
  const statusLine = orderStatus === "arrived_at_delivery"
    ? "Tài xế đã tới điểm giao"
    : orderStatus === "delivering"
      ? isDrone ? "Drone đang bay đến bạn" : "Shipper đang giao hàng"
      : "Quán đang chuẩn bị món";

  return {
    orderLine: `ĐƠN #${orderId.slice(-6).toUpperCase()}`,
    statusLine,
    icon: isDrone ? "drone" as const : "motorcycle" as const,
  };
};
