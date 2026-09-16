import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { Order } from "../../types";

interface ActiveOrderBannerProps {
  order?: Order | null;
  onPress: (order: Order) => void;
}

export const ActiveOrderBanner: React.FC<ActiveOrderBannerProps> = ({
  order,
  onPress,
}) => {
  if (!order || (order.orderStatus !== "preparing" && order.orderStatus !== "delivering")) {
    return null;
  }

  const isDrone = order.deliveryMethod === "drone";

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        style={styles.banner}
        onPress={() => onPress(order)}
      >
        <View style={styles.left}>
          <Text style={styles.icon}>{isDrone ? "🛸" : "🛵"}</Text>
          <View>
            <Text style={styles.title}>
              Đơn #{order._id.slice(-6).toUpperCase()} •{" "}
              {order.orderStatus === "delivering"
                ? isDrone
                  ? "Drone đang bay đến bạn"
                  : "Shipper đang giao hàng"
                : "Quán đang chuẩn bị món"}
            </Text>
            <Text style={styles.subtitle}>Chạm để xem lộ trình trực tiếp</Text>
          </View>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    backgroundColor: colors.canvas,
  },
  banner: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    ...typography.captionBold,
    color: colors.primary,
  },
  subtitle: {
    ...typography.micro,
    color: colors.textSecondary,
    marginTop: 1,
  },
  arrow: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: "700",
  },
});
