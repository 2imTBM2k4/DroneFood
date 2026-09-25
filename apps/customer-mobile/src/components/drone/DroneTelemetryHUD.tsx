import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Icon } from "../common/Icon";
import { GlassSurface } from "../common/GlassSurface";
import type { DroneTelemetry } from "../../types";

interface DroneTelemetryHUDProps {
  telemetry?: DroneTelemetry;
  etaMinutes?: number;
}

export const DroneTelemetryHUD: React.FC<DroneTelemetryHUDProps> = ({
  telemetry,
  etaMinutes = 5,
}) => {
  const battery = telemetry?.batteryPercent ?? 85;
  const speed = telemetry?.speedKmh ?? 38;
  const altitude = telemetry?.altitudeMeters ?? 65;
  const eta = telemetry?.etaMinutes ?? etaMinutes;

  const getBatteryColor = () => {
    if (battery >= 50) return colors.batteryHigh;
    if (battery >= 25) return colors.batteryMed;
    return colors.batteryLow;
  };

  return (
    <GlassSurface tone="strong" contentStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleBadge}>
          <Icon name="drone" size={17} color={colors.primary} />
          <Text style={styles.titleText}>DRONE FLIGHT TELEMETRY</Text>
        </View>
        <View style={styles.statusLive}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE HUD</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{altitude} m</Text>
          <Text style={styles.metricLabel}>Độ cao bay</Text>
        </View>
        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{speed} km/h</Text>
          <Text style={styles.metricLabel}>Vận tốc</Text>
        </View>
        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: getBatteryColor() }]}>{battery}%</Text>
          <Text style={styles.metricLabel}>Pin Drone</Text>
        </View>
        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: colors.primary }]}>
            {eta} phút
          </Text>
          <Text style={styles.metricLabel}>Dự kiến đến</Text>
        </View>
      </View>
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
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
    letterSpacing: 0.8,
  },
  statusLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.statusDeliveredBg,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
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
  },
  metricsGrid: {
    flexDirection: "row",
    backgroundColor: "rgba(235, 245, 255, 0.76)",
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    justifyContent: "space-around",
    alignItems: "center",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  metricValue: {
    ...typography.subhead,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  metricLabel: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
});
