import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "../../../components/Map";
import { formatVnd } from "../../api/client";
import { Header } from "../../components/common/Header";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { Order } from "../../types";

interface ShipperTrackingScreenProps {
  order: Order | null;
  loading: boolean;
  onBack: () => void;
}

type MapCoordinate = { latitude: number; longitude: number };

const coordinateFor = (lat?: number, lng?: number): MapCoordinate | null => {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng };
};

const routeCoordinatesFor = (geometry?: [number, number][]): MapCoordinate[] => (
  Array.isArray(geometry)
    ? geometry.flatMap(([lng, lat]) => {
      const coordinate = coordinateFor(lat, lng);
      return coordinate ? [coordinate] : [];
    })
    : []
);

const etaMinutesFor = (durationSeconds?: number) => (
  Number.isFinite(durationSeconds) && durationSeconds! >= 0
    ? Math.max(1, Math.ceil(durationSeconds! / 60))
    : null
);

const paymentLabel = (paymentMethod?: string) => {
  if (paymentMethod === "PAYOS") return "Thanh toán Online PayOS";
  if (paymentMethod === "COD") return "Tiền mặt khi nhận hàng";
  return paymentMethod || "Chưa xác định";
};

export const ShipperTrackingScreen: React.FC<ShipperTrackingScreenProps> = ({ order, loading, onBack }) => {
  const shipper = coordinateFor(order?.tracking?.location.lat, order?.tracking?.location.lng);
  const restaurant = coordinateFor(order?.restaurantId?.lat, order?.restaurantId?.lng);
  const dropoff = coordinateFor(order?.shippingAddress?.lat, order?.shippingAddress?.lng);
  const route = useMemo(() => routeCoordinatesFor(order?.tracking?.route?.geometry), [order?.tracking?.route?.geometry]);
  const etaMinutes = etaMinutesFor(order?.tracking?.route?.durationSeconds);
  const routeUnavailable = order?.tracking?.routeStatus === "unavailable";
  const mapCenter = shipper || dropoff || restaurant || { latitude: 10.7769, longitude: 106.7009 };
  const mapRegion = {
    ...mapCenter,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  if (loading && !order) {
    return <View style={styles.loading}><Text style={styles.muted}>Đang tải đơn hàng...</Text></View>;
  }

  if (!order || order.deliveryMethod !== "shipper") {
    return <View style={styles.container}><Header title="Theo dõi tài xế" onBack={onBack} /><View style={styles.loading}><Text style={styles.muted}>Không tìm thấy thông tin giao hàng của tài xế.</Text></View></View>;
  }

  const isDelivering = order.orderStatus === "delivering";
  const address = [order.shippingAddress?.address, order.shippingAddress?.city, order.shippingAddress?.state]
    .filter(Boolean)
    .join(", ");
  const calculatedItemsPrice = (order.orderItems || []).every((item) => typeof item.price === "number")
    ? (order.orderItems || []).reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
    : undefined;
  const itemsPrice = order.itemsPrice ?? calculatedItemsPrice;

  return <View style={styles.container}>
    <Header title={`Theo dõi tài xế #${order._id.slice(-6).toUpperCase()}`} subtitle="Vị trí và lộ trình được cập nhật trực tiếp" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.mapWrap}>
        <MapView style={styles.map} initialRegion={mapRegion}>
          {!routeUnavailable && route.length >= 2 ? <Polyline coordinates={route} strokeColor="#2563EB" strokeWidth={5} /> : null}
          {restaurant ? <Marker coordinate={restaurant} title={order.restaurantId?.name || "Nhà hàng"} description="Điểm lấy món" pinColor="#EA580C" /> : null}
          {dropoff ? <Marker coordinate={dropoff} title="Điểm nhận hàng" description={order.shippingAddress?.address || ""} pinColor="#16A34A" /> : null}
          {shipper ? <Marker coordinate={shipper} title={order.shipperId?.name || "Tài xế"} description="Đang giao hàng" pinColor="#2563EB" /> : null}
        </MapView>
      </View>

      <View style={styles.statusCard}>
        {order.orderStatus === "arrived_at_delivery" ? <Text style={styles.statusText}>Tài xế đã tới điểm giao. Bạn vẫn có thể xem vị trí trực tiếp của tài xế trên bản đồ.</Text> : null}
        {order.orderStatus !== "arrived_at_delivery" && shipper && routeUnavailable ? <Text style={styles.statusText}>Không thể cập nhật lộ trình lúc này. Vị trí GPS của tài xế vẫn đang được cập nhật.</Text> : null}
        {order.orderStatus !== "arrived_at_delivery" && shipper && !routeUnavailable && etaMinutes !== null ? <Text style={styles.statusText}>Tài xế đang đến · Còn khoảng {etaMinutes} phút</Text> : null}
        {order.orderStatus !== "arrived_at_delivery" && shipper && !routeUnavailable && etaMinutes === null ? <Text style={styles.statusText}>Tài xế đang đến · Đang cập nhật lộ trình…</Text> : null}
        {!shipper && isDelivering ? <Text style={styles.statusText}>Đang kết nối tín hiệu GPS từ thiết bị của tài xế...</Text> : null}
        {!isDelivering && order.orderStatus !== "arrived_at_delivery" ? <Text style={styles.statusText}>Đơn hàng chưa được tài xế lấy từ nhà hàng.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Thông tin giao hàng</Text>
        <Text style={styles.label}>Nhà hàng</Text>
        <Text style={styles.value}>{order.restaurantId?.name || "Nhà hàng đối tác"}</Text>
        {order.restaurantId?.address ? <Text style={styles.muted}>{order.restaurantId.address}</Text> : null}
        <View style={styles.divider} />
        <Text style={styles.label}>Người nhận</Text>
        <Text style={styles.value}>{order.shippingAddress?.fullName || "Khách hàng"}{order.shippingAddress?.phone ? ` · ${order.shippingAddress.phone}` : ""}</Text>
        <Text style={styles.muted}>{address || "Chưa có địa chỉ nhận hàng"}</Text>
        {order.shipperId?.name ? <>
          <View style={styles.divider} />
          <Text style={styles.label}>Tài xế giao hàng</Text>
          <Text style={styles.value}>{order.shipperId.name}{order.shipperId.phone ? ` · ${order.shipperId.phone}` : ""}</Text>
        </> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Món đã đặt</Text>
        {(order.orderItems || []).length === 0 ? <Text style={styles.muted}>Chưa có thông tin món ăn.</Text> : null}
        {(order.orderItems || []).map((item, index) => (
          <View key={`${item.name}-${index}`} style={styles.itemRow}>
            <View style={styles.itemTextWrap}>
              <Text style={styles.value}>{item.name} × {item.quantity}</Text>
              {(item.selectedOptions || []).map((option) => <Text key={`${option.groupName}-${option.optionName}`} style={styles.optionText}>• {option.groupName}: {option.optionName}</Text>)}
              {item.note ? <Text style={styles.optionText}>Ghi chú: {item.note}</Text> : null}
            </View>
            {item.price != null ? <Text style={styles.itemPrice}>{formatVnd(item.price * item.quantity)}</Text> : null}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Thanh toán</Text>
        {itemsPrice != null ? <View style={styles.summaryRow}><Text style={styles.muted}>Tiền món</Text><Text style={styles.summaryValue}>{formatVnd(itemsPrice)}</Text></View> : null}
        <View style={styles.summaryRow}><Text style={styles.muted}>Phí giao hàng</Text><Text style={styles.summaryValue}>{formatVnd(order.shippingPrice)}</Text></View>
        {order.serviceFee != null && order.serviceFee > 0 ? <View style={styles.summaryRow}><Text style={styles.muted}>Phí dịch vụ</Text><Text style={styles.summaryValue}>{formatVnd(order.serviceFee)}</Text></View> : null}
        {order.discountAmount != null && order.discountAmount > 0 ? <View style={styles.summaryRow}><Text style={styles.muted}>Giảm giá</Text><Text style={styles.discountValue}>-{formatVnd(order.discountAmount)}</Text></View> : null}
        <View style={styles.divider} />
        <View style={styles.summaryRow}><Text style={styles.totalLabel}>Tổng thanh toán</Text><Text style={styles.total}>{formatVnd(order.totalPrice)}</Text></View>
        <Text style={styles.muted}>Hình thức: {paymentLabel(order.paymentMethod)}</Text>
      </View>
    </ScrollView>
  </View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parchment },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  muted: { color: colors.textSecondary, ...typography.body },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 110 },
  mapWrap: { height: 320, overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.surfaceSubtle },
  map: { flex: 1 },
  statusCard: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.borderFocus },
  statusText: { color: colors.textPrimary, ...typography.body, fontWeight: "700" },
  card: { backgroundColor: colors.surfaceCard, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { ...typography.title2, color: colors.textPrimary, marginBottom: spacing.xs },
  label: { ...typography.captionBold, color: colors.textSecondary },
  value: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, paddingVertical: spacing.xs },
  itemTextWrap: { flex: 1 },
  optionText: { ...typography.bodySecondary, color: colors.textSecondary, marginTop: 2 },
  itemPrice: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  summaryValue: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  discountValue: { ...typography.body, fontWeight: "700", color: colors.success },
  totalLabel: { ...typography.subheadBold, color: colors.textPrimary },
  total: { ...typography.title2, color: colors.primary },
});
