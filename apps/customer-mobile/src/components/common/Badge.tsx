import React from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { OrderStatus } from "../../types";

export type BadgeVariant = "mint" | "neutral" | "primary" | "status";

export interface BadgeProps {
  label?: string;
  variant?: BadgeVariant;
  status?: OrderStatus | "drone" | "shipper" | "open" | "closed" | string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: colors.statusPendingBg, text: colors.statusPendingText, label: "Chờ xác nhận" },
  preparing: { bg: colors.statusPreparingBg, text: colors.statusPreparingText, label: "Đang chuẩn bị" },
  delivering: { bg: colors.statusDeliveringBg, text: colors.statusDeliveringText, label: "Đang giao" },
  arrived_at_delivery: { bg: colors.statusDeliveringBg, text: colors.statusDeliveringText, label: "Đã tới điểm giao" },
  delivered: { bg: colors.statusDeliveredBg, text: colors.statusDeliveredText, label: "Đã giao" },
  cancelled: { bg: colors.statusCancelledBg, text: colors.statusCancelledText, label: "Đã hủy" },
  drone: { bg: colors.badgeMintBg, text: colors.badgeMintText, label: "Drone" },
  shipper: { bg: colors.surfaceSubtle, text: colors.textSecondary, label: "Shipper" },
  open: { bg: colors.statusDeliveredBg, text: colors.statusDeliveredText, label: "Mở cửa" },
  closed: { bg: colors.surfaceSubtle, text: colors.textMuted, label: "Đóng cửa" },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant,
  status,
  icon,
  style,
  textStyle,
}) => {
  // If status is provided, use status configuration
  if (status && statusConfig[status]) {
    const config = statusConfig[status];
    return (
      <View style={[styles.badge, { backgroundColor: config.bg }, style]}>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
        <Text style={[styles.badgeText, { color: config.text }, textStyle]}>
          {label || config.label}
        </Text>
      </View>
    );
  }

  // Default / Mint variant (like "Editor's pick" in reference image)
  const isMint = variant === "mint" || (!variant && !status);
  const isPrimary = variant === "primary";

  const bg = isPrimary
    ? colors.primary
    : isMint
    ? colors.badgeMintBg
    : colors.surfaceSubtle;

  const textColor = isPrimary
    ? colors.textWhite
    : isMint
    ? colors.badgeMintText
    : colors.textSecondary;

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={[styles.badgeText, { color: textColor }, textStyle]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    marginRight: spacing.xxs,
  },
  badgeText: {
    ...typography.micro,
    fontWeight: "600",
  },
});
