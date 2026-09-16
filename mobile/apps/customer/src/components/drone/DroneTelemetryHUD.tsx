import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
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
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleBadge}>
          <Text style={styles.droneIcon}>🛸</Text>
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
          <Text style={[styles.metricValue, { color: getBatteryColor() }]}>
            🔋 {battery}%
          </Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
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
  droneIcon: {
    fontSize: 16,
  },
  titleText: {
    ...typography.captionBold,
    color: "#E2E8F0",
    letterSpacing: 0.8,
  },
  statusLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveText: {
    ...typography.micro,
    color: "#10B981",
  },
  metricsGrid: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: radius.md,
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
    color: "#FFFFFF",
    fontWeight: "700",
  },
  metricLabel: {
    ...typography.micro,
    color: "#94A3B8",
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
});
