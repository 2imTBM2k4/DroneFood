import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, motion, radius, shadows, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Icon } from "../common/Icon";
import type { Cart } from "../../types";

interface FloatingCartBarProps { cart?: Cart; onPress: () => void; }

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({ cart, onPress }) => {
  const totalCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;
  if (totalCount <= 0) return null;

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.bar, shadows.floating, pressed && styles.pressed]} onPress={onPress}>
        <View style={styles.left}>
          <View style={styles.count}><Text style={styles.countText}>{totalCount}</Text></View>
          <View>
            <Text style={styles.label}>Giỏ hàng</Text>
            <Text style={styles.price}>{formatVnd(cart?.subtotal || 0)}</Text>
          </View>
        </View>
        <View style={styles.action}><Text style={styles.actionText}>Xem giỏ</Text><Icon name="chevron-right" size={17} color={colors.textWhite} /></View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: "absolute", bottom: 90, left: spacing.md, right: spacing.md, zIndex: 99 },
  bar: { minHeight: 64, backgroundColor: colors.primary, borderRadius: radius.xl, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pressed: { opacity: motion.pressedOpacity, transform: [{ scale: motion.pressedScale }] },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  count: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: "rgba(255, 255, 255, 0.18)", alignItems: "center", justifyContent: "center" },
  countText: { color: colors.textWhite, ...typography.subheadBold },
  label: { ...typography.micro, color: "rgba(255, 255, 255, 0.72)" },
  price: { ...typography.subheadBold, color: colors.textWhite },
  action: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  actionText: { ...typography.captionBold, color: colors.textWhite },
});
