import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Icon } from "../common/Icon";
import { calculateDroneEtaMinutes } from "../../config/droneSimulation";
import type { DroneTelemetry } from "../../types";

interface DroneTelemetryHUDProps {
  telemetry?: DroneTelemetry;
  orderStatus?: string;
  dronePhase?: string;
  etaMinutes?: number | null;
  distanceKm?: number | null;
}

const DRONE_PHASE_LABELS: Record<string, string> = {
  assigned: "Đã chỉ định Drone",
  preflight_check: "Kiểm tra kỹ thuật tiền chuyến bay",
  en_route_to_restaurant: "Drone đang bay tới nhà hàng",
  awaiting_restaurant_handover: "Đang nhận món tại nhà hàng",
  en_route_to_customer: "Drone đang bay tới điểm giao",
  arrived_at_customer: "Drone đã tới điểm giao, sẵn sàng hạ cánh",
  delivered: "Đã hoàn thành chuyến bay",
};

export const DroneTelemetryHUD: React.FC<DroneTelemetryHUDProps> = ({
  telemetry,
  orderStatus = "delivering",
  dronePhase = "en_route_to_customer",
  etaMinutes,
  distanceKm,
}) => {
  // Compute ETA: only display minutes when dronePhase is "en_route_to_customer"
  const isEnRoute = dronePhase === "en_route_to_customer" || orderStatus === "delivering";
  const calculatedMinutes =
    etaMinutes ??
    telemetry?.etaMinutes ??
    (distanceKm ? calculateDroneEtaMinutes(distanceKm) : null) ??
    5;

  const etaDisplay = isEnRoute ? `~${calculatedMinutes} phút` : "Đang cập nhật";
  const phaseLabel = DRONE_PHASE_LABELS[dronePhase] || "Đang xử lý chuyến bay";

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleBadge}>
          <Icon name="drone" size={18} color={colors.primary} />
          <Text style={styles.titleText}>THEO DÕI HÀNH TRÌNH DRONE</Text>
        </View>
        <View style={styles.statusLive}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>TRỰC TIẾP</Text>
        </View>
      </View>

      <View style={styles.metricsBox}>
        {/* Status display */}
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Trạng thái chặng bay</Text>
          <Text numberOfLines={1} style={styles.statusValue}>
            {phaseLabel}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        {/* ETA display */}
        <View style={styles.etaItem}>
          <Text style={styles.metricLabel}>Dự kiến đến</Text>
          <Text style={styles.etaValue}>{etaDisplay}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  titleText: {
    ...typography.captionBold,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  statusLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.statusDeliveredBg,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    ...typography.micro,
    color: colors.success,
    fontWeight: "700",
  },
  metricsBox: {
    flexDirection: "row",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.md,
  },
  metricItem: {
    flex: 1,
    gap: 2,
  },
  etaItem: {
    alignItems: "flex-end",
    gap: 2,
  },
  metricLabel: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  statusValue: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  etaValue: {
    ...typography.title2,
    color: colors.primary,
    fontWeight: "700",
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderSubtle,
  },
});
