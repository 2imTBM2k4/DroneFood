import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Icon, type IconName } from "./Icon";
import type { OrderStatus } from "../../types";

export interface StatusBadgeProps {
  status: OrderStatus | string;
  label?: string;
  style?: StyleProp<ViewStyle>;
  showIcon?: boolean;
}

interface StatusItemConfig {
  bg: string;
  text: string;
  defaultLabel: string;
  iconName: IconName;
}

const statusConfigs: Record<string, StatusItemConfig> = {
  pending: {
    bg: colors.statusPendingBg, // #FEF3C7
    text: colors.statusPendingText, // #92400E (Amber, 5.59:1 WCAG AA)
    defaultLabel: "Chờ xác nhận",
    iconName: "clock",
  },
  preparing: {
    bg: colors.statusPreparingBg, // #EDE9FE
    text: colors.statusPreparingText, // #5B21B6 (Purple, 6.92:1 WCAG AA)
    defaultLabel: "Đang chuẩn bị",
    iconName: "sparkles",
  },
  delivering: {
    bg: colors.statusDeliveringBg, // #E0F2FE
    text: colors.statusDeliveringText, // #075985 (Sky, 5.75:1 WCAG AA)
    defaultLabel: "Đang giao hàng",
    iconName: "drone",
  },
  arrived_at_delivery: {
    bg: colors.statusDeliveringBg,
    text: colors.statusDeliveringText,
    defaultLabel: "Đã đến nơi",
    iconName: "map-pin",
  },
  delivered: {
    bg: colors.statusDeliveredBg, // #DCFCE7
    text: colors.statusDeliveredText, // #166534 (Emerald Green, 5.65:1 WCAG AA, distinct from Teal)
    defaultLabel: "Giao thành công",
    iconName: "check",
  },
  cancelled: {
    bg: colors.statusCancelledBg, // #FEE2E2
    text: colors.statusCancelledText, // #991B1B (Red, 6.13:1 WCAG AA)
    defaultLabel: "Đã hủy",
    iconName: "close",
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  style,
  showIcon = true,
}) => {
  const config: StatusItemConfig = statusConfigs[status] || {
    bg: colors.surfaceSubtle,
    text: colors.textSecondary,
    defaultLabel: label || status,
    iconName: "clock",
  };

  const displayText = label || config.defaultLabel;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Trạng thái: ${displayText}`}
      style={[styles.badge, { backgroundColor: config.bg }, style]}
    >
      {showIcon ? (
        <View style={styles.iconContainer}>
          <Icon name={config.iconName} size={13} color={config.text} variant="solid" />
        </View>
      ) : null}
      <Text style={[styles.text, { color: config.text }]}>
        {displayText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    minHeight: 26,
  },
  iconContainer: {
    marginRight: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "600",
  },
});
