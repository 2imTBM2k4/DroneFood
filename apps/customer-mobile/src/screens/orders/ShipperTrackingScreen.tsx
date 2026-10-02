import React, { useMemo } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "../../../components/Map";
import { formatVnd, resolveMediaUrl } from "../../api/client";
import { Header } from "../../components/common/Header";
import { Icon } from "../../components/common/Icon";
import { InfoRow } from "../../components/common/InfoRow";
import { Timeline } from "../../components/common/Timeline";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { Order } from "../../types";

interface ShipperTrackingScreenProps {
  order: Order | null;
  loading: boolean;
  onBack: () => void;
}

type MapCoordinate = { latitude: number; longitude: number };

const coordinateFor = (lat?: number, lng?: number): MapCoordinate | null => {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  return { latitude: lat, longitude: lng };
};

const routeCoordinatesFor = (geometry?: [number, number][]): MapCoordinate[] =>
  Array.isArray(geometry)
    ? geometry.flatMap(([lng, lat]) => {
        const coordinate = coordinateFor(lat, lng);
        return coordinate ? [coordinate] : [];
      })
    : [];

const etaMinutesFor = (durationSeconds?: number) =>
  Number.isFinite(durationSeconds) && durationSeconds! >= 0
    ? Math.max(1, Math.ceil(durationSeconds! / 60))
    : null;

const paymentLabel = (paymentMethod?: string) => {
  if (paymentMethod === "PAYOS") return "Thanh toán Online PayOS";
  if (paymentMethod === "COD") return "Tiền mặt khi nhận hàng";
  return paymentMethod || "Chưa xác định";
};

export const ShipperTrackingScreen: React.FC<ShipperTrackingScreenProps> = ({
  order,
  loading,
  onBack,
}) => {
  const shipper = coordinateFor(order?.tracking?.location.lat, order?.tracking?.location.lng);
  const restaurant = coordinateFor(order?.restaurantId?.lat, order?.restaurantId?.lng);
  const dropoff = coordinateFor(order?.shippingAddress?.lat, order?.shippingAddress?.lng);
  const route = useMemo(
    () => routeCoordinatesFor(order?.tracking?.route?.geometry),
    [order?.tracking?.route?.geometry]
  );
  const etaMinutes = etaMinutesFor(order?.tracking?.route?.durationSeconds);
  const routeUnavailable = order?.tracking?.routeStatus === "unavailable";
  const mapCenter = shipper || dropoff || restaurant || { latitude: 10.7769, longitude: 106.7009 };
  const mapRegion = {
    ...mapCenter,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  if (loading && !order) {
    return (
      <View style={styles.loading}>
        <Text style={styles.muted}>Đang tải đơn hàng...</Text>
      </View>
    );
  }

  if (!order || order.deliveryMethod !== "shipper") {
    return (
      <View style={styles.container}>
        <Header title="Theo dõi tài xế" onBack={onBack} />
        <View style={styles.loading}>
          <Text style={styles.muted}>Không tìm thấy thông tin giao hàng của tài xế.</Text>
        </View>
      </View>
    );
  }

  const isDelivering = order.orderStatus === "delivering";
  const address = [
    order.shippingAddress?.address,
    order.shippingAddress?.city,
    order.shippingAddress?.state,
  ]
    .filter(Boolean)
    .join(", ");
  const calculatedItemsPrice = (order.orderItems || []).every(
    (item) => typeof item.price === "number"
  )
    ? (order.orderItems || []).reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
    : undefined;
  const itemsPrice = order.itemsPrice ?? calculatedItemsPrice;

  return (
    <View style={styles.container}>
      <Header
        title={`Theo dõi tài xế #${order._id.slice(-6).toUpperCase()}`}
        subtitle="Vị trí và lộ trình được cập nhật trực tiếp qua GPS"
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Interactive Map View */}
        <View style={styles.mapWrap}>
          <MapView style={styles.map} initialRegion={mapRegion}>
            {!routeUnavailable && route.length >= 2 ? (
              <Polyline coordinates={route} strokeColor={colors.primary} strokeWidth={4} />
            ) : null}
            {restaurant ? (
              <Marker
                coordinate={restaurant}
                title={order.restaurantId?.name || "Nhà hàng"}
                description="Điểm lấy món"
                pinColor={colors.textSecondary}
              />
            ) : null}
            {dropoff ? (
              <Marker
                coordinate={dropoff}
                title="Điểm nhận hàng"
                description={order.shippingAddress?.address || ""}
                pinColor={colors.success}
              />
            ) : null}
            {shipper ? (
              <Marker
                coordinate={shipper}
                title={order.shipperId?.name || "Tài xế"}
                description="Đang giao hàng"
                pinColor={colors.primary}
              />
            ) : null}
          </MapView>
        </View>

        {/* Live Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIconWrap}>
              <Icon name="motorcycle" size={20} color={colors.primary} />
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle}>Trạng thái tài xế</Text>
              {order.orderStatus === "arrived_at_delivery" ? (
                <Text style={styles.statusMessage}>
                  Tài xế đã tới điểm giao. Bạn có thể ra nhận món ăn!
                </Text>
              ) : null}
              {order.orderStatus !== "arrived_at_delivery" && shipper && routeUnavailable ? (
                <Text style={styles.statusMessage}>
                  Không thể cập nhật lộ trình đường đi. Vị trí GPS của tài xế vẫn đang kết nối.
                </Text>
              ) : null}
              {order.orderStatus !== "arrived_at_delivery" &&
              shipper &&
              !routeUnavailable &&
              etaMinutes !== null ? (
                <Text style={styles.statusMessage}>
                  Tài xế đang di chuyển · Dự kiến đến sau khoảng {etaMinutes} phút
                </Text>
              ) : null}
              {order.orderStatus !== "arrived_at_delivery" &&
              shipper &&
              !routeUnavailable &&
              etaMinutes === null ? (
                <Text style={styles.statusMessage}>Tài xế đang đến · Đang cập nhật lộ trình…</Text>
              ) : null}
              {!shipper && isDelivering ? (
                <Text style={styles.statusMessage}>
                  Đang kết nối tín hiệu GPS từ thiết bị của tài xế...
                </Text>
              ) : null}
              {!isDelivering && order.orderStatus !== "arrived_at_delivery" ? (
                <Text style={styles.statusMessage}>
                  Đơn hàng đang chuẩn bị, tài xế sẽ lấy món tại nhà hàng sớm.
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Progress Timeline Stepper */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tiến trình giao hàng</Text>
          <Timeline deliveryMethod="shipper" orderStatus={order.orderStatus} />
        </View>

        {/* Delivery Info Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin giao hàng</Text>
          
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nhà hàng</Text>
            <Text style={styles.value}>{order.restaurantId?.name || "Nhà hàng đối tác"}</Text>
            {order.restaurantId?.address ? (
              <Text style={styles.muted}>{order.restaurantId.address}</Text>
            ) : null}
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Người nhận</Text>
            <Text style={styles.value}>
              {order.shippingAddress?.fullName || "Khách hàng"}
              {order.shippingAddress?.phone ? ` · ${order.shippingAddress.phone}` : ""}
            </Text>
            <Text style={styles.muted}>{address || "Chưa có địa chỉ nhận hàng"}</Text>
          </View>

          {order.shipperId?.name ? (
            <>
              <View style={styles.divider} />
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Tài xế giao hàng</Text>
                <Text style={styles.value}>
                  {order.shipperId.name}
                  {order.shipperId.phone ? ` · ${order.shipperId.phone}` : ""}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Ordered Items Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Món đã đặt</Text>
          {(order.orderItems || []).length === 0 ? (
            <Text style={styles.muted}>Chưa có thông tin món ăn.</Text>
          ) : null}
          {(order.orderItems || []).map((item, index) => {
            const foodImg = item.image || (typeof item.product === "object" && item.product?.image);
            return (
              <View key={`${item.name}-${index}`} style={styles.itemRow}>
                {foodImg ? (
                  <Image
                    source={{ uri: resolveMediaUrl(foodImg) }}
                    style={styles.foodThumb}
                    resizeMode="cover"
                    accessibilityLabel={`Hình món ${item.name}`}
                  />
                ) : (
                  <View style={styles.foodThumbFallback}>
                    <Icon name="utensils" size={14} color={colors.primary} />
                  </View>
                )}
                <View style={styles.itemTextWrap}>
                  <Text style={styles.value}>
                    {item.name} × {item.quantity}
                  </Text>
                  {(item.selectedOptions || []).map((option) => (
                    <Text
                      key={`${option.groupName}-${option.optionName}`}
                      style={styles.optionText}
                    >
                      • {option.groupName}: {option.optionName}
                    </Text>
                  ))}
                  {item.note ? <Text style={styles.optionText}>Ghi chú: {item.note}</Text> : null}
                </View>
                {item.price != null ? (
                  <Text style={styles.itemPrice}>
                    {formatVnd(item.price * item.quantity)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Payment Breakdown Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Chi tiết thanh toán</Text>
          {itemsPrice != null ? <InfoRow label="Tổng tạm tính" value={formatVnd(itemsPrice)} /> : null}
          <InfoRow
            label="Phí áp dụng (Phí ship)"
            value={formatVnd(order.shippingPrice)}
            subValue={order.deliveryDistanceKm ? `${order.deliveryDistanceKm.toFixed(1)} km` : undefined}
          />
          {order.serviceFee != null && order.serviceFee > 0 ? (
            <InfoRow label="Phí dịch vụ" value={formatVnd(order.serviceFee)} />
          ) : null}
          {order.discountAmount != null && order.discountAmount > 0 ? (
            order.vouchers && order.vouchers.length > 0 ? (
              order.vouchers.map((voucher, vIdx) => (
                <InfoRow
                  key={`voucher-${voucher.code}-${vIdx}`}
                  label={`Giảm ${formatVnd(voucher.discountAmount)} (${voucher.code})`}
                  value={`-${formatVnd(voucher.discountAmount)}`}
                  valueStyle={styles.discountValue}
                />
              ))
            ) : (
              <InfoRow
                label={`Giảm ${formatVnd(order.discountAmount)} voucher`}
                value={`-${formatVnd(order.discountAmount)}`}
                valueStyle={styles.discountValue}
              />
            )
          ) : null}
          <View style={styles.divider} />
          <InfoRow label="Tổng cộng" value={formatVnd(order.totalPrice)} isTotal />
          <Text style={styles.paymentMethod}>
            Hình thức: {paymentLabel(order.paymentMethod)}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  muted: {
    color: colors.textSecondary,
    ...typography.body,
  },
  content: {
    padding: spacing.screenPadding,
    gap: spacing.md,
    paddingBottom: 110,
  },
  mapWrap: {
    height: 250,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  map: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTextWrap: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  statusMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subheadBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  fieldGroup: {
    gap: 2,
  },
  label: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  value: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.xs,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  foodThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
  },
  foodThumbFallback: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTextWrap: {
    flex: 1,
  },
  optionText: {
    ...typography.micro,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 2,
  },
  paymentMethod: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  discountValue: {
    color: colors.success,
    fontWeight: "700",
  },
});
