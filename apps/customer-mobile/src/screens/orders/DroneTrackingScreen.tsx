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
import { Icon, type IconName } from "../../components/common/Icon";
import { GlassSurface } from "../../components/common/GlassSurface";
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

  const steps: { key: string; label: string; icon: IconName }[] = [
    { key: "pending", label: "Đã nhận đơn", icon: "check" },
    { key: "preparing", label: "Quán đang nấu", icon: "utensils" },
    {
      key: "delivering",
      label: isDrone ? "Drone đang bay" : "Shipper đang giao",
      icon: isDrone ? "drone" : "motorcycle",
    },
    { key: "delivered", label: "Đã giao thành công", icon: "package" },
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
              strokeColor={colors.primary}
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
        <GlassSurface tone="strong" contentStyle={styles.timelineCard}>
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
                    <Icon
                      name={step.icon}
                      size={16}
                      color={isCompleted ? colors.textWhite : colors.textSecondary}
                    />
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
        </GlassSurface>

        {/* Drone Cargo Unlock CTA (Only when Drone is actively delivering) */}
        {isDrone && order.orderStatus === "delivering" ? (
          <View style={styles.cargoSection}>
            <Button
              label="Mở khoang hàng & quét QR Drone"
              icon={<Icon name="package" size={17} color={colors.textWhite} />}
              variant="primary"
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
            loading={working}
            onPress={() => setCancelModalVisible(true)}
          />
        ) : null}

        {/* Review prompt card for delivered orders */}
        {order.orderStatus === "delivered" && (
          <View style={styles.reviewPromptCard}>
            {currentOrder?.reviewFlow?.complete ? (
              <View style={styles.reviewCompleteRow}>
                <Icon name="check" size={17} color={colors.success} />
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
                  <Text style={styles.reviewPromptCardBtnText}>Đánh giá</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Order Details Breakdown Card */}
        <GlassSurface tone="strong" contentStyle={styles.detailsCard}>
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
        </GlassSurface>
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
    backgroundColor: "transparent",
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 110,
  },
  mapContainer: {
    height: 252,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.94)",
    backgroundColor: colors.surfaceSubtle,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 4,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  timelineCard: {
    padding: spacing.lg,
    gap: spacing.md,
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
    flexDirection: "column",
    position: "relative",
    paddingTop: spacing.xxs,
  },
  stepItem: {
    minHeight: 58,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
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
  stepLabel: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  stepLabelCompleted: {
    color: colors.primary,
    fontWeight: "700",
  },
  stepLine: {
    position: "absolute",
    top: 31,
    left: 15,
    width: 2,
    height: 28,
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
    backgroundColor: colors.statusDeliveredBg,
    borderWidth: 1,
    borderColor: colors.statusDeliveredText,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  deliveredSuccessIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
  },
  deliveredSuccessTextWrap: {
    flex: 1,
    gap: 2,
  },
  deliveredSuccessTitle: {
    ...typography.subhead,
    color: colors.statusDeliveredText,
    fontWeight: "700",
  },
  deliveredSuccessSub: {
    ...typography.caption,
    color: colors.statusDeliveredText,
    lineHeight: 18,
  },
  detailsCard: {
    padding: spacing.lg,
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
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.98)",
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
    backgroundColor: "rgba(235, 245, 255, 0.86)",
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.94)",
  },
  reviewCompleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewCompleteText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.success,
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
    color: colors.textPrimary,
  },
  reviewPromptCardSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reviewPromptCardBtn: {
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    shadowColor: colors.primary,
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
