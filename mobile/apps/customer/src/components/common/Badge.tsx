import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { OrderStatus } from "../../types";

interface BadgeProps {
  label?: string;
  status?: OrderStatus | "drone" | "shipper" | "open" | "closed";
  style?: ViewStyle;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pending: {
    bg: colors.statusPendingBg,
    text: colors.statusPendingText,
    label: "Chờ xác nhận",
  },
  preparing: {
    bg: colors.statusPreparingBg,
    text: colors.statusPreparingText,
    label: "Đang chuẩn bị",
  },
  delivering: {
    bg: colors.statusDeliveringBg,
    text: colors.statusDeliveringText,
    label: "Đang giao",
  },
  arrived_at_delivery: {
    bg: "#CFFAFE",
    text: "#155E75",
    label: "Đã tới điểm giao",
  },
  delivered: {
    bg: colors.statusDeliveredBg,
    text: colors.statusDeliveredText,
    label: "Đã giao",
  },
  cancelled: {
    bg: colors.statusCancelledBg,
    text: colors.statusCancelledText,
    label: "Đã hủy",
  },
  drone: {
    bg: "#E0F2FE",
    text: "#0284C7",
    label: "🛸 Drone Bay",
  },
  shipper: {
    bg: "#FEF3C7",
    text: "#D97706",
    label: "🛵 Shipper",
  },
  open: {
    bg: colors.statusDeliveredBg,
    text: colors.statusDeliveredText,
    label: "Đang mở cửa",
  },
  closed: {
    bg: colors.surfaceSubtle,
    text: colors.textMuted,
    label: "Đóng cửa",
  },
};

export const Badge: React.FC<BadgeProps> = ({ label, status = "pending", style }) => {
  const config = statusConfig[status] || {
    bg: colors.surfaceSubtle,
    text: colors.textSecondary,
    label: label || status,
  };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, style]}>
      <Text style={[styles.badgeText, { color: config.text }]}>
        {label || config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  badgeText: {
    ...typography.micro,
    fontWeight: "700",
  },
});
