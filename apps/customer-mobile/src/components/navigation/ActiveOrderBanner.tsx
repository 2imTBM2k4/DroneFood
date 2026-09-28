import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GlassSurface } from "../common/GlassSurface";
import { Icon } from "../common/Icon";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import type { Order } from "../../types";
import { buildActiveOrderBannerContent } from "./activeOrderBannerState";

interface ActiveOrderBannerProps { order?: Order | null; onPress: (order: Order) => void; }

export const ActiveOrderBanner: React.FC<ActiveOrderBannerProps> = ({ order, onPress }) => {
  if (!order || !["preparing", "delivering", "arrived_at_delivery"].includes(order.orderStatus)) return null;
  const content = buildActiveOrderBannerContent({
    orderId: order._id,
    orderStatus: order.orderStatus,
    deliveryMethod: order.deliveryMethod,
  });

  return (
    <View style={styles.container}>
      <GlassSurface radiusValue={radius.lg} intensity={62} tone="soft" contentStyle={styles.glassContent}>
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.banner, pressed && styles.pressed]} onPress={() => onPress(order)}>
          <View style={styles.iconBox}><Icon name={content.icon} size={18} color={colors.primary} /></View>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>{content.orderLine}</Text>
            <Text style={styles.title}>{content.statusLine}</Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.primary} />
        </Pressable>
      </GlassSurface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: "absolute", bottom: 90, left: spacing.md, right: spacing.md, zIndex: 100 },
  glassContent: { padding: spacing.xxs },
  banner: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.xs },
  pressed: { opacity: motion.pressedOpacity, transform: [{ scale: motion.pressedScale }] },
  iconBox: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  eyebrow: { ...typography.micro, color: colors.primary },
  title: { ...typography.captionBold, color: colors.textPrimary, marginTop: 1 },
});
