import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../common/Icon";
import { colors, motion, radius, shadows, spacing, typography } from "../../theme/tokens";
import type { Order } from "../../types";
import { buildActiveOrderBannerContent } from "./activeOrderBannerState";

interface ActiveOrderBannerProps {
  order?: Order | null;
  onPress: (order: Order) => void;
}

export const ActiveOrderBanner: React.FC<ActiveOrderBannerProps> = ({ order, onPress }) => {
  if (!order || !["preparing", "delivering", "arrived_at_delivery"].includes(order.orderStatus))
    return null;
  const content = buildActiveOrderBannerContent({
    orderId: order._id,
    orderStatus: order.orderStatus,
    deliveryMethod: order.deliveryMethod,
  });

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Đơn hàng đang hoạt động: ${content.statusLine}`}
        style={({ pressed }) => [
          styles.banner,
          shadows.floating,
          pressed && styles.pressed,
        ]}
        onPress={() => onPress(order)}
      >
        <View style={styles.iconBox}>
          <Icon name={content.icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{content.orderLine}</Text>
          <Text style={styles.title}>{content.statusLine}</Text>
        </View>
        <Icon name="chevron-right" size={20} color={colors.primary} />
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
    zIndex: 100,
  },
  banner: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#003366",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: "700",
  },
  title: {
    ...typography.captionBold,
    color: colors.textPrimary,
    marginTop: 1,
  },
});
