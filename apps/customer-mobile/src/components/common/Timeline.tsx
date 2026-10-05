import React from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Icon, type IconName } from "./Icon";
import type { DeliveryMethod, OrderStatus } from "../../types";

export interface TimelineProps {
  deliveryMethod?: DeliveryMethod;
  orderStatus: OrderStatus | string;
  dronePhase?: string;
  style?: StyleProp<ViewStyle>;
}

interface TimelineStep {
  key: string;
  label: string;
  icon: IconName;
}

// 7 distinct operational phases for drone delivery
const droneSteps: TimelineStep[] = [
  { key: "assigned", label: "Đã nhận đơn", icon: "check" },
  { key: "preflight_check", label: "Kiểm tra kỹ thuật", icon: "settings" },
  { key: "en_route_to_restaurant", label: "Bay tới nhà hàng", icon: "drone" },
  { key: "awaiting_restaurant_handover", label: "Nhận món tại quán", icon: "sparkles" },
  { key: "en_route_to_customer", label: "Bay tới điểm giao", icon: "drone" },
  { key: "arrived_at_customer", label: "Đã hạ cánh, sẵn sàng nhận", icon: "package" },
  { key: "delivered", label: "Giao thành công", icon: "check" },
];

// Steps for traditional shipper delivery
const shipperSteps: TimelineStep[] = [
  { key: "pending", label: "Đã nhận đơn", icon: "check" },
  { key: "preparing", label: "Quán đang nấu", icon: "sparkles" },
  { key: "delivering", label: "Shipper đang giao", icon: "motorcycle" },
  { key: "arrived_at_delivery", label: "Tài xế đã đến nơi", icon: "map-pin" },
  { key: "delivered", label: "Đã giao thành công", icon: "check" },
];

export const Timeline: React.FC<TimelineProps> = ({
  deliveryMethod = "drone",
  orderStatus,
  dronePhase,
  style,
}) => {
  const isDrone = deliveryMethod === "drone";
  const isCancelled = orderStatus === "cancelled";
  const steps = isDrone ? droneSteps : shipperSteps;

  // Resolve step index based on dronePhase or fallback to orderStatus
  const resolveCurrentIndex = (): number => {
    if (isCancelled) return -1;

    if (isDrone && dronePhase) {
      switch (dronePhase) {
        case "assigned":
          return 0;
        case "preflight_check":
          return 1;
        case "en_route_to_restaurant":
          return 2;
        case "awaiting_restaurant_handover":
          return 3;
        case "en_route_to_customer":
          return 4;
        case "arrived_at_customer":
          return 5;
        case "delivered":
          return 6;
        default:
          break;
      }
    }

    // Fallback based purely on orderStatus when dronePhase is missing/undefined
    if (orderStatus === "delivered") return steps.length - 1;
    if (orderStatus === "arrived_at_delivery") return isDrone ? 5 : 3;
    if (orderStatus === "delivering") return isDrone ? 4 : 2;
    if (orderStatus === "preparing") return isDrone ? 3 : 1;
    return 0; // pending / assigned
  };

  const currentIndex = resolveCurrentIndex();

  return (
    <View style={[styles.container, style]}>
      {isCancelled ? (
        <View style={styles.cancelledBanner}>
          <Icon name="close" size={16} color={colors.statusCancelledText} />
          <Text style={styles.cancelledText}>Đơn hàng đã bị hủy</Text>
        </View>
      ) : null}

      <View style={styles.stepsList}>
        {steps.map((step, idx) => {
          const isCompleted = !isCancelled && currentIndex > idx;
          const isCurrent = !isCancelled && currentIndex === idx;
          const isPending = !isCancelled && currentIndex < idx;

          return (
            <View key={step.key} style={styles.stepRow}>
              {/* Left Indicator & Connecting Line */}
              <View style={styles.indicatorColumn}>
                <View
                  style={[
                    styles.node,
                    isCompleted && styles.nodeCompleted,
                    isCurrent && styles.nodeCurrent,
                    (isPending || isCancelled) && styles.nodePending,
                  ]}
                >
                  <Icon
                    name={step.icon}
                    size={12}
                    color={
                      isCompleted || isCurrent
                        ? colors.textWhite
                        : colors.textSecondary
                    }
                    variant={isCompleted || isCurrent ? "solid" : "outline"}
                  />
                </View>

                {/* Vertical Line between nodes */}
                {idx < steps.length - 1 ? (
                  <View
                    style={[
                      styles.connectingLine,
                      isCompleted && styles.lineCompleted,
                    ]}
                  />
                ) : null}
              </View>

              {/* Right Step Label */}
              <View style={styles.textColumn}>
                <Text
                  style={[
                    styles.stepLabel,
                    isCurrent && styles.stepLabelCurrent,
                    isCompleted && styles.stepLabelCompleted,
                    (isPending || isCancelled) && styles.stepLabelPending,
                  ]}
                >
                  {step.label}
                </Text>
                {isCurrent ? (
                  <Text style={styles.currentSubtext}>Đang xử lý bước này</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cancelledBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.statusCancelledBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  cancelledText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.statusCancelledText,
  },
  stepsList: {
    paddingVertical: spacing.xxs,
  },
  stepRow: {
    flexDirection: "row",
    minHeight: 46,
  },
  indicatorColumn: {
    alignItems: "center",
    width: 28,
  },
  node: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  nodeCompleted: {
    backgroundColor: colors.primary,
  },
  nodeCurrent: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  nodePending: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectingLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: 2,
  },
  lineCompleted: {
    backgroundColor: colors.primary,
  },
  textColumn: {
    flex: 1,
    marginLeft: spacing.sm,
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  stepLabel: {
    ...typography.body,
    fontSize: 13,
  },
  stepLabelCurrent: {
    fontWeight: "700",
    color: colors.primary,
  },
  stepLabelCompleted: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  stepLabelPending: {
    color: colors.textMuted,
  },
  currentSubtext: {
    ...typography.micro,
    color: colors.primary,
    marginTop: 1,
  },
});
