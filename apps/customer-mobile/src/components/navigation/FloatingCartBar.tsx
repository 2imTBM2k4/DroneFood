import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, motion, radius, shadows, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Icon } from "../common/Icon";
import type { Cart } from "../../types";

export interface FloatingCartBarProps {
  cart?: Cart;
  onPress: () => void;
}

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({
  cart,
  onPress,
}) => {
  const totalCount =
    cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;
  if (totalCount <= 0) return null;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Giỏ hàng có ${totalCount} món, tổng cộng ${formatVnd(cart?.subtotal || 0)}. Bấm để xem chi tiết`}
        style={({ pressed }) => [
          styles.bar,
          shadows.floating,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
      >
        <View style={styles.left}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{totalCount}</Text>
          </View>
          <View style={styles.textColumn}>
            <Text style={styles.label}>Giỏ hàng</Text>
            <Text style={styles.price}>{formatVnd(cart?.subtotal || 0)}</Text>
          </View>
        </View>
        <View style={styles.action}>
          <Text style={styles.actionText}>Xem giỏ</Text>
          <Icon name="chevron-right" size={16} color={colors.textWhite} />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 66,
    left: spacing.md,
    right: spacing.md,
    zIndex: 99,
  },
  bar: {
    minHeight: 56,
    backgroundColor: colors.primary,
    borderRadius: radius.pill, // Pill geometry
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countText: {
    color: colors.textWhite,
    ...typography.caption,
    fontWeight: "700",
  },
  textColumn: {
    justifyContent: "center",
  },
  label: {
    ...typography.micro,
    color: "rgba(255, 255, 255, 0.78)",
    fontWeight: "500",
  },
  price: {
    ...typography.price,
    color: colors.textWhite,
    fontSize: 15,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  actionText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textWhite,
    fontSize: 14,
  },
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
});
