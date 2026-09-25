import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GlassSurface } from "../common/GlassSurface";
import { Icon } from "../common/Icon";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import type { Order } from "../../types";

interface ActiveOrderBannerProps { order?: Order | null; onPress: (order: Order) => void; }

export const ActiveOrderBanner: React.FC<ActiveOrderBannerProps> = ({ order, onPress }) => {
  if (!order || !["preparing", "delivering", "arrived_at_delivery"].includes(order.orderStatus)) return null;
  const isDrone = order.deliveryMethod === "drone";
  const statusLabel = order.orderStatus === "arrived_at_delivery"
    ? "Tài xế đã tới điểm giao"
    : order.orderStatus === "delivering"
      ? isDrone ? "Drone đang bay đến bạn" : "Shipper đang giao hàng"
      : "Quán đang chuẩn bị món";

  return (
    <View style={styles.container}>
      <GlassSurface radiusValue={radius.lg} intensity={62} tone="soft" contentStyle={styles.glassContent}>
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.banner, pressed && styles.pressed]} onPress={() => onPress(order)}>
          <View style={styles.iconBox}><Icon name={isDrone ? "drone" : "motorcycle"} size={22} color={colors.primary} /></View>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>ĐƠN #{order._id.slice(-6).toUpperCase()}</Text>
            <Text style={styles.title}>{statusLabel}</Text>
            <Text style={styles.subtitle}>Xem lộ trình trực tiếp</Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.primary} />
        </Pressable>
      </GlassSurface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: "transparent" },
  glassContent: { padding: spacing.xs },
  banner: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xs },
  pressed: { opacity: motion.pressedOpacity, transform: [{ scale: motion.pressedScale }] },
  iconBox: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  eyebrow: { ...typography.micro, color: colors.primary },
  title: { ...typography.captionBold, color: colors.textPrimary, marginTop: 1 },
  subtitle: { ...typography.micro, color: colors.textSecondary, marginTop: 1 },
});
