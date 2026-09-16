import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { Header } from "../../components/common/Header";
import { Input } from "../../components/common/Input";
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

  const customerLat = order.shippingAddress?.lat || 10.7769;
  const customerLng = order.shippingAddress?.lng || 106.7009;
  const restaurantLat = order.restaurantId?.lat || 10.7800;
  const restaurantLng = order.restaurantId?.lng || 106.6950;

  // Drone simulated position between restaurant and customer
  const droneLat = (restaurantLat + customerLat) / 2;
  const droneLng = (restaurantLng + customerLng) / 2;

  const mapRegion = {
    latitude: (restaurantLat + customerLat) / 2,
    longitude: (restaurantLng + customerLng) / 2,
    latitudeDelta: Math.max(0.02, Math.abs(restaurantLat - customerLat) * 1.8),
    longitudeDelta: Math.max(0.02, Math.abs(restaurantLng - customerLng) * 1.8),
  };

  const steps = [
    { key: "pending", label: "Đã nhận đơn", icon: "✓" },
    { key: "preparing", label: "Quán đang nấu", icon: "🍳" },
    {
      key: "delivering",
      label: isDrone ? "Drone đang bay" : "Shipper đang giao",
      icon: isDrone ? "🛸" : "🛵",
    },
    { key: "delivered", label: "Đã giao thành công", icon: "📦" },
  ];

  const getStepStatus = (stepKey: string) => {
    const orderSequence = ["pending", "preparing", "delivering", "delivered"];
    const currentIndex = orderSequence.indexOf(order.orderStatus);
    const stepIndex = orderSequence.indexOf(stepKey);

    if (order.orderStatus === "cancelled") return "cancelled";
    if (currentIndex >= stepIndex) return "completed";
    return "pending";
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      Alert.alert("Thiếu lý do", "Vui lòng nhập lý do bạn muốn hủy đơn.");
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
        subtitle={isDrone ? "🛸 Giao hàng bằng Drone" : "🛵 Giao bằng Shipper"}
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
                title="Drone-04 đang bay"
                description="Độ cao 65m • Tốc độ 38km/h"
              />
            ) : null}

            {/* Flight Polyline */}
            <Polyline
              coordinates={[
                { latitude: restaurantLat, longitude: restaurantLng },
                { latitude: customerLat, longitude: customerLng },
              ]}
              strokeColor={isDrone ? "#0066CC" : "#F59E0B"}
              strokeWidth={3}
              lineDashPattern={isDrone ? [6, 4] : undefined}
            />
          </MapView>
        </View>

        {/* Live Telemetry HUD (for Drone orders) */}
        {isDrone && (order.orderStatus === "delivering" || order.orderStatus === "preparing") ? (
          <DroneTelemetryHUD
            telemetry={order.droneTelemetry}
            etaMinutes={order.orderStatus === "delivering" ? 4 : 12}
          />
        ) : null}

        {/* Status Stepper Timeline */}
        <View style={styles.timelineCard}>
          <View style={styles.timelineHeader}>
            <Text style={styles.timelineTitle}>Tiến trình đơn hàng</Text>
            <Badge status={order.orderStatus} />
          </View>

          <View style={styles.stepper}>
            {steps.map((step, idx) => {
              const status = getStepStatus(step.key);
              const isCompleted = status === "completed";
              return (
                <View key={step.key} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      isCompleted && styles.stepCircleCompleted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepIcon,
                        isCompleted && styles.stepIconCompleted,
                      ]}
                    >
                      {step.icon}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      isCompleted && styles.stepLabelCompleted,
                    ]}
                  >
                    {step.label}
                  </Text>
                  {idx !== steps.length - 1 ? (
                    <View
                      style={[
                        styles.stepLine,
                        isCompleted && styles.stepLineCompleted,
                      ]}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>

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
              label="📦 Mở Khoang Hàng & Quét QR Drone"
              variant="primary"
              onPress={() => setCargoModalVisible(true)}
            />
          </View>
        ) : null}

        {/* Delivered Success Confirmation Box */}
        {order.orderStatus === "delivered" ? (
          <View style={styles.deliveredSuccessBox}>
            <Text style={styles.deliveredSuccessIcon}>🎉</Text>
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
            loading={working}
            onPress={() => setCancelModalVisible(true)}
          />
        ) : null}

        {/* Review prompt card for delivered orders */}
        {order.orderStatus === "delivered" && (
          <View style={styles.reviewPromptCard}>
            {currentOrder?.reviewFlow?.complete ? (
              <View style={styles.reviewCompleteRow}>
                <Text style={styles.reviewCompleteCheck}>✓</Text>
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
                  style={styles.reviewPromptCardBtn}
                  onPress={() => setReviewModalVisible(true)}
                >
                  <Text style={styles.reviewPromptCardBtnText}>Đánh giá ⭐</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Order Details Breakdown Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Chi tiết các món đã đặt</Text>
          {(order.orderItems || []).map((item, index) => (
            <View key={`${item.name}-${index}`} style={styles.itemRow}>
              <View>
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
          ))}

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Tổng tiền thanh toán</Text>
            <Text style={styles.totalPriceText}>
              {formatVnd(order.totalPrice)}
            </Text>
          </View>
          <Text style={styles.paymentMethodLabel}>
            Hình thức: {order.paymentMethod === "PAYOS" ? "Thanh toán Online PayOS" : "Tiền mặt COD"}
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

            <Button
              label="Xác nhận hủy đơn"
              variant="danger"
              loading={working}
              onPress={handleConfirmCancel}
            />
            <Button
              label="Quay lại"
              variant="outline"
              onPress={() => setCancelModalVisible(false)}
            />
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
    backgroundColor: colors.parchment,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 110,
  },
  mapContainer: {
    height: 220,
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
  timelineCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  stepper: {
    flexDirection: "row",
    justifyContent: "space-between",
    position: "relative",
    paddingVertical: spacing.xs,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
    gap: 4,
    position: "relative",
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 2,
  },
  stepCircleCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepIcon: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  stepIconCompleted: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  stepLabel: {
    ...typography.micro,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 68,
  },
  stepLabelCompleted: {
    color: colors.primary,
    fontWeight: "700",
  },
  stepLine: {
    position: "absolute",
    top: 15,
    left: "50%",
    width: "100%",
    height: 2,
    backgroundColor: colors.border,
    zIndex: 1,
  },
  stepLineCompleted: {
    backgroundColor: colors.primary,
  },
  reasonBox: {
    backgroundColor: colors.statusCancelledBg,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  reasonText: {
    ...typography.caption,
    color: colors.statusCancelledText,
  },
  cargoSection: {
    marginVertical: spacing.xxs,
  },
  deliveredSuccessBox: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  deliveredSuccessIcon: {
    fontSize: 32,
  },
  deliveredSuccessTextWrap: {
    flex: 1,
    gap: 2,
  },
  deliveredSuccessTitle: {
    ...typography.subhead,
    color: "#15803D",
    fontWeight: "700",
  },
  deliveredSuccessSub: {
    ...typography.caption,
    color: "#166534",
    lineHeight: 18,
  },
  detailsCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  detailsTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemName: {
    ...typography.bodySecondary,
    color: colors.textPrimary,
  },
  itemOpt: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  itemPrice: {
    ...typography.bodySecondary,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  totalPriceText: {
    ...typography.title2,
    color: colors.primary,
    fontWeight: "700",
  },
  paymentMethodLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dialogCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.xl,
    padding: spacing.lg,
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
  reviewPromptCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  reviewCompleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewCompleteCheck: {
    color: "#16A34A",
    fontWeight: "800",
    fontSize: 16,
  },
  reviewCompleteText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#15803D",
  },
  reviewPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  reviewPromptCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#92400E",
  },
  reviewPromptCardSub: {
    fontSize: 12,
    color: "#B45309",
    marginTop: 2,
  },
  reviewPromptCardBtn: {
    backgroundColor: "#D97706",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewPromptCardBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
