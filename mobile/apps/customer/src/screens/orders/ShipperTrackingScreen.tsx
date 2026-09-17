import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "../../../components/Map";
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
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
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

export const ShipperTrackingScreen: React.FC<ShipperTrackingScreenProps> = ({ order, loading, onBack }) => {
  const shipper = coordinateFor(order?.tracking?.location.lat, order?.tracking?.location.lng);
  const restaurant = coordinateFor(order?.restaurantId?.lat, order?.restaurantId?.lng);
  const dropoff = coordinateFor(order?.shippingAddress?.lat, order?.shippingAddress?.lng);
  const route = useMemo(() => routeCoordinatesFor(order?.tracking?.route?.geometry), [order?.tracking?.route?.geometry]);
  const etaMinutes = etaMinutesFor(order?.tracking?.route?.durationSeconds);
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
  return <View style={styles.container}>
    <Header title={`Theo dõi tài xế #${order._id.slice(-6).toUpperCase()}`} subtitle="Vị trí và lộ trình được cập nhật trực tiếp" onBack={onBack} />
    <View style={styles.mapWrap}>
      <MapView style={styles.map} initialRegion={mapRegion}>
        {route.length >= 2 ? <Polyline coordinates={route} strokeColor="#2563EB" strokeWidth={5} /> : null}
        {restaurant ? <Marker coordinate={restaurant} title={order.restaurantId?.name || "Nhà hàng"} description="Điểm lấy món" pinColor="#EA580C" /> : null}
        {dropoff ? <Marker coordinate={dropoff} title="Điểm nhận hàng" description={order.shippingAddress?.address || ""} pinColor="#16A34A" /> : null}
        {shipper ? <Marker coordinate={shipper} title={order.shipperId?.name || "Tài xế"} description="Đang giao hàng" pinColor="#2563EB" /> : null}
      </MapView>
    </View>
    <View style={styles.statusCard}>
      {order.orderStatus === "arrived_at_delivery" ? <Text style={styles.statusText}>Tài xế đã tới điểm giao. Bạn vẫn có thể xem vị trí trực tiếp của tài xế trên bản đồ.</Text> : null}
      {order.orderStatus !== "arrived_at_delivery" && shipper && etaMinutes !== null ? <Text style={styles.statusText}>Tài xế đang đến · Còn khoảng {etaMinutes} phút</Text> : null}
      {order.orderStatus !== "arrived_at_delivery" && shipper && etaMinutes === null ? <Text style={styles.statusText}>Tài xế đang đến · Đang cập nhật lộ trình…</Text> : null}
      {!shipper && isDelivering ? <Text style={styles.statusText}>Đang kết nối tín hiệu GPS từ thiết bị của tài xế...</Text> : null}
      {!isDelivering && order.orderStatus !== "arrived_at_delivery" ? <Text style={styles.statusText}>Đơn hàng chưa được tài xế lấy từ nhà hàng.</Text> : null}
    </View>
  </View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  muted: { color: colors.textSecondary, ...typography.body },
  mapWrap: { margin: spacing.md, height: 350, overflow: "hidden", borderRadius: radius.lg },
  map: { flex: 1 },
  statusCard: { marginHorizontal: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.border },
  statusText: { color: colors.textPrimary, ...typography.body, fontWeight: "700" },
});
