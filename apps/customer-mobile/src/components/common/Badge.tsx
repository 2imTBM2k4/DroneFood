import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { OrderStatus } from "../../types";

interface BadgeProps {
  label?: string;
  status?: OrderStatus | "drone" | "shipper" | "open" | "closed";
  style?: StyleProp<ViewStyle>;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: colors.statusPendingBg, text: colors.statusPendingText, label: "Chờ xác nhận" },
  preparing: { bg: colors.statusPreparingBg, text: colors.statusPreparingText, label: "Đang chuẩn bị" },
  delivering: { bg: colors.statusDeliveringBg, text: colors.statusDeliveringText, label: "Đang giao" },
  arrived_at_delivery: { bg: colors.statusDeliveringBg, text: colors.statusDeliveringText, label: "Đã tới điểm giao" },
  delivered: { bg: colors.statusDeliveredBg, text: colors.statusDeliveredText, label: "Đã giao" },
  cancelled: { bg: colors.statusCancelledBg, text: colors.statusCancelledText, label: "Đã hủy" },
  drone: { bg: colors.primaryLight, text: colors.primary, label: "Drone" },
  shipper: { bg: colors.surfaceSubtle, text: colors.textSecondary, label: "Shipper" },
  open: { bg: colors.statusDeliveredBg, text: colors.statusDeliveredText, label: "Mở cửa" },
  closed: { bg: colors.surfaceSubtle, text: colors.textMuted, label: "Đóng cửa" },
};

export const Badge: React.FC<BadgeProps> = ({ label, status = "pending", style }) => {
  const config = statusConfig[status] || { bg: colors.surfaceSubtle, text: colors.textSecondary, label: label || status };
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, style]}>
      <Text style={[styles.badgeText, { color: config.text }]}>{label || config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { minHeight: 28, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.pill, alignSelf: "flex-start", justifyContent: "center" },
  badgeText: { ...typography.micro },
});
