import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import type { Cart } from "../../types";

interface FloatingCartBarProps {
  cart?: Cart;
  onPress: () => void;
}

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({
  cart,
  onPress,
}) => {
  const totalCount =
    cart?.items.reduce((acc, item) => acc + item.quantity, 0) || 0;

  if (totalCount <= 0) return null;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.bar, pressed && styles.barPressed]}
        onPress={onPress}
      >
        <View style={styles.left}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalCount}</Text>
          </View>
          <View>
            <Text style={styles.title}>Giỏ hàng của bạn</Text>
            <Text style={styles.price}>{formatVnd(cart?.subtotal || 0)}</Text>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.actionText}>Xem giỏ →</Text>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 74,
    left: spacing.md,
    right: spacing.md,
    zIndex: 99,
  },
  bar: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  barPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    ...typography.subhead,
    fontWeight: "700",
  },
  title: {
    ...typography.caption,
    color: "#94A3B8",
  },
  price: {
    ...typography.subhead,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  right: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  actionText: {
    ...typography.captionBold,
    color: "#FFFFFF",
  },
});
