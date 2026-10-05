import React, { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd, resolveMediaUrl } from "../../api/client";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { Header } from "../../components/common/Header";
import { Input } from "../../components/common/Input";
import { Icon } from "../../components/common/Icon";
import { InfoRow } from "../../components/common/InfoRow";
import { Timeline } from "../../components/common/Timeline";
import { useToast } from "../../components/common/ToastProvider";
import { CargoUnlockModal } from "../../components/drone/CargoUnlockModal";
import { DroneTelemetryHUD } from "../../components/drone/DroneTelemetryHUD";
import { OrderReviewModal } from "../../components/orders/OrderReviewModal";
import MapView, { Marker, Polyline } from "../../../components/Map";
import type { Order } from "../../types";

interface DroneTrackingScreenProps {
  order: Order | null;
  loading: boolean;
  onBack: () => void;
  onOpenCargo: (order: Order) => Promise<void>;
  onConfirmDelivery: (order: Order) => Promise<void>;
  onCancelOrder: (orderId: string, reason: string) => Promise<void>;
  working: boolean;
}

export const DroneTrackingScreen: React.FC<DroneTrackingScreenProps> = ({
  order,
  loading,
  onBack,
  onOpenCargo,
  onConfirmDelivery,
  onCancelOrder,
  working,
}) => {
  const { showToast } = useToast();
  const [cargoModalVisible, setCargoModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(order);

  React.useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  if (!order) {
    return (
      <View style={styles.container}>
        <Header title="Theo dõi đơn hàng" onBack={onBack} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Không tìm thấy thông tin đơn hàng.</Text>
        </View>
      </View>
    );
  }

  const isDrone = order.deliveryMethod === "drone";
  const canCancel = order.orderStatus === "pending";

  const calculatedItemsPrice = (order.orderItems || []).every(
    (item) => typeof item.price === "number"
  )
    ? (order.orderItems || []).reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
    : undefined;
  const itemsPrice = order.itemsPrice ?? calculatedItemsPrice;

  const customerLat = order.shippingAddress?.lat || 10.7769;
  const customerLng = order.shippingAddress?.lng || 106.7009;
  const restaurantLat = order.restaurantId?.lat || 10.78;
  const restaurantLng = order.restaurantId?.lng || 106.695;

  // Drone simulated position between restaurant and customer
  const droneLat = (restaurantLat + customerLat) / 2;
  const droneLng = (restaurantLng + customerLng) / 2;

  const mapRegion = {
    latitude: (restaurantLat + customerLat) / 2,
    longitude: (restaurantLng + customerLng) / 2,
    latitudeDelta: Math.max(0.02, Math.abs(restaurantLat - customerLat) * 1.8),
    longitudeDelta: Math.max(0.02, Math.abs(restaurantLng - customerLng) * 1.8),
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      showToast({
        type: "warning",
        title: "Thiếu lý do",
        message: "Vui lòng nhập lý do bạn muốn hủy đơn.",
      });
      return;
    }
    await onCancelOrder(order._id, cancelReason.trim());
    setCancelModalVisible(false);
    setCancelReason("");
  };

  return (
    <View style={styles.container}>
      <Header
        title={`Đơn #${order._id.slice(-6).toUpperCase()}`}
        subtitle={isDrone ? "Giao hàng bằng Drone" : "Giao bằng Shipper"}
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Interactive Map View */}
        <View style={styles.mapContainer}>
          <MapView style={styles.map} initialRegion={mapRegion}>
            {/* Restaurant Marker */}
            <Marker
              coordinate={{ latitude: restaurantLat, longitude: restaurantLng }}
              title={order.restaurantId?.name || "Nhà hàng"}
              description="Điểm cất cánh / lấy món"
            />

            {/* Customer Marker */}
            <Marker
              coordinate={{ latitude: customerLat, longitude: customerLng }}
              title="Điểm nhận hàng của bạn"
              description={order.shippingAddress?.address || ""}
            />

            {/* Drone Marker (when delivering) */}
            {order.orderStatus === "delivering" && isDrone ? (
              <Marker
                coordinate={{ latitude: droneLat, longitude: droneLng }}
                title="Drone đang bay"
                description="Đang di chuyển tới điểm giao"
              />
            ) : null}

            {/* Flight Polyline */}
            <Polyline
              coordinates={[
                { latitude: restaurantLat, longitude: restaurantLng },
                { latitude: customerLat, longitude: customerLng },
              ]}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={isDrone ? [6, 4] : undefined}
            />
          </MapView>
        </View>

        {/* Live Telemetry HUD (for Drone orders) */}
        {isDrone &&
        (order.orderStatus === "delivering" ||
          order.orderStatus === "preparing" ||
          order.orderStatus === "pending") ? (
          <DroneTelemetryHUD
            telemetry={order.droneTelemetry}
            orderStatus={order.orderStatus}
            dronePhase={order.dronePhase}
            distanceKm={order.deliveryDistanceKm}
          />
        ) : null}

        {/* Status Timeline */}
        <View style={styles.card}>
          <View style={styles.timelineHeader}>
            <Text style={styles.sectionTitle}>Tiến trình đơn hàng</Text>
            <Badge status={order.orderStatus} />
          </View>

          <Timeline
            deliveryMethod={order.deliveryMethod}
            orderStatus={order.orderStatus}
            dronePhase={order.dronePhase}
          />

          {order.reason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>Lý do hủy: {order.reason}</Text>
            </View>
          ) : null}
        </View>

        {/* Drone Cargo Unlock CTA (Only when Drone is actively delivering) */}
        {isDrone && order.orderStatus === "delivering" ? (
          <View style={styles.cargoSection}>
            <Button
              label="Mở khoang hàng & quét QR Drone"
              icon={<Icon name="package" size={18} color={colors.textWhite} />}
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => setCargoModalVisible(true)}
            />
          </View>
        ) : null}

        {/* Delivered Success Confirmation Box */}
        {order.orderStatus === "delivered" ? (
          <View style={styles.deliveredSuccessBox}>
            <View style={styles.deliveredSuccessIcon}>
              <Icon name="check" size={22} color={colors.success} />
            </View>
            <View style={styles.deliveredSuccessTextWrap}>
              <Text style={styles.deliveredSuccessTitle}>
                Đơn hàng đã giao thành công!
              </Text>
              <Text style={styles.deliveredSuccessSub}>
                Bạn đã nhận đủ món ăn. Khoang hàng Drone đã được khóa an toàn. Cảm ơn bạn đã lựa chọn Drone Food!
              </Text>
            </View>
          </View>
        ) : null}

        {/* Cancel Button (if pending) */}
        {canCancel ? (
          <Button
            label="Hủy đơn hàng"
            variant="danger"
            size="lg"
            fullWidth
            loading={working}
            onPress={() => setCancelModalVisible(true)}
          />
        ) : null}

        {/* Review prompt card for delivered orders */}
        {order.orderStatus === "delivered" && (
          <View style={styles.reviewPromptCard}>
            {currentOrder?.reviewFlow?.complete ? (
              <View style={styles.reviewCompleteRow}>
                <Icon name="check" size={18} color={colors.success} />
                <Text style={styles.reviewCompleteText}>
                  Đã gửi đánh giá cho đơn hàng này
                </Text>
              </View>
            ) : (
              <View style={styles.reviewPromptRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewPromptCardTitle}>
                    Đơn hàng đã hoàn thành
                  </Text>
                  <Text style={styles.reviewPromptCardSub}>
                    Hãy để lại đánh giá cho trải nghiệm của bạn!
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.reviewPromptCardBtn,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Đánh giá đơn hàng"
                  onPress={() => setReviewModalVisible(true)}
                >
                  <Text style={styles.reviewPromptCardBtnText}>Đánh giá</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Order Details Breakdown Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Chi tiết các món đã đặt</Text>
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
                  <Text style={styles.itemName}>
                    {item.name} × {item.quantity}
                  </Text>
                  {item.selectedOptions?.map((opt) => (
                    <Text
                      key={`${opt.groupName}-${opt.optionName}`}
                      style={styles.itemOpt}
                    >
                      • {opt.groupName}: {opt.optionName}
                    </Text>
                  ))}
                </View>
                {item.price ? (
                  <Text style={styles.itemPrice}>
                    {formatVnd(item.price * item.quantity)}
                  </Text>
                ) : null}
              </View>
            );
          })}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Chi tiết thanh toán</Text>
          {itemsPrice != null ? <InfoRow label="Tổng tạm tính" value={formatVnd(itemsPrice)} /> : null}
          <InfoRow
            label="Phí áp dụng (Giao bằng drone)"
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
          <Text style={styles.paymentMethodLabel}>
            Hình thức:{" "}
            {order.paymentMethod === "PAYOS"
              ? "Thanh toán Online PayOS"
              : "Tiền mặt COD"}
          </Text>
        </View>
      </ScrollView>

      {/* QR & Cargo Bay Unlock Modal */}
      <CargoUnlockModal
        order={order}
        visible={cargoModalVisible}
        onClose={() => setCargoModalVisible(false)}
        onOpenCargo={onOpenCargo}
        onConfirmDelivery={onConfirmDelivery}
        loading={working}
      />

      {/* Cancel Reason Dialog */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Hủy đơn hàng</Text>
            <Text style={styles.dialogSubtitle}>
              Vui lòng cho Drone Food biết lý do bạn muốn hủy đơn:
            </Text>

            <Input
              placeholder="Ví dụ: Đổi ý không muốn ăn món này nữa..."
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />

            <View style={styles.dialogActions}>
              <Button
                label="Xác nhận hủy đơn"
                variant="danger"
                fullWidth
                loading={working}
                onPress={handleConfirmCancel}
              />
              <Button
                label="Quay lại"
                variant="outline"
                fullWidth
                onPress={() => setCancelModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      <OrderReviewModal
        visible={reviewModalVisible}
        order={currentOrder}
        onClose={() => setReviewModalVisible(false)}
        onReviewCompleted={(orderId, updatedFlow) => {
          if (currentOrder && currentOrder._id === orderId) {
            setCurrentOrder({ ...currentOrder, reviewFlow: updatedFlow });
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    gap: spacing.md,
    paddingBottom: 110,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
  mapContainer: {
    height: 250,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: "#003366",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  reasonBox: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.statusCancelledBg,
    borderRadius: radius.sm,
  },
  reasonText: {
    ...typography.caption,
    color: colors.danger,
  },
  cargoSection: {
    marginTop: spacing.xxs,
  },
  deliveredSuccessBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.statusDeliveredBg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  deliveredSuccessIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  deliveredSuccessTextWrap: {
    flex: 1,
  },
  deliveredSuccessTitle: {
    ...typography.subheadBold,
    color: colors.statusDeliveredText,
  },
  deliveredSuccessSub: {
    ...typography.caption,
    color: colors.statusDeliveredText,
    marginTop: 2,
    lineHeight: 18,
  },
  reviewPromptCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
  },
  reviewPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  reviewPromptCardTitle: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  reviewPromptCardSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reviewPromptCardBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewPromptCardBtnText: {
    ...typography.captionBold,
    color: colors.textWhite,
  },
  reviewCompleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  reviewCompleteText: {
    ...typography.subheadBold,
    color: colors.success,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.xs,
    gap: spacing.sm,
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
  itemName: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  itemOpt: {
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
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.xs,
  },
  paymentMethodLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    gap: spacing.md,
  },
  dialogTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  dialogSubtitle: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
  dialogActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
  discountValue: {
    color: colors.success,
    fontWeight: "700",
  },
});
