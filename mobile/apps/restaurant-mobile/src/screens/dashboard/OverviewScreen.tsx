import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Button } from "../../components/common/Button";
import type { Food, Order, Restaurant } from "../../types";

interface OverviewScreenProps {
  restaurant?: Restaurant | null;
  orders: Order[];
  foods: Food[];
  working: boolean;
  onToggleOpen: () => Promise<void>;
  onGoOrders: () => void;
  onGoMenu: () => void;
  onGoWallet: () => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  restaurant,
  orders,
  foods,
  working,
  onToggleOpen,
  onGoOrders,
  onGoMenu,
  onGoWallet,
}) => {
  const isOpen = restaurant?.isOpen !== false;

  // Filter today's orders
  const todayStr = new Date().toDateString();
  const todayOrders = orders.filter(
    (o) => new Date(o.createdAt).toDateString() === todayStr
  );

  const todayRevenue = todayOrders
    .filter((o) => o.orderStatus !== "cancelled")
    .reduce((sum, o) => sum + o.totalPrice, 0);

  const needsActionCount = orders.filter((o) =>
    ["pending", "preparing"].includes(o.orderStatus)
  ).length;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Store Header & Open/Close Switch */}
      <View style={styles.storeCard}>
        <View style={styles.storeLeft}>
          <Text numberOfLines={1} style={styles.storeName}>
            {restaurant?.name || "Nhà hàng của bạn"}
          </Text>
          <View style={styles.statusIndicatorRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOpen ? colors.success : colors.danger },
              ]}
            />
            <Text style={styles.statusText}>
              {isOpen ? "Quán đang mở nhận đơn" : "Quán đang đóng cửa"}
            </Text>
          </View>
        </View>

        <Button
          label={isOpen ? "Tạm đóng quán" : "Mở quán ngay"}
          variant={isOpen ? "outline" : "success"}
          loading={working}
          style={styles.openToggleBtn}
          onPress={onToggleOpen}
        />
      </View>

      {/* Metrics Section */}
      <Text style={styles.sectionTitle}>Chỉ số hôm nay</Text>
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{formatVnd(todayRevenue)}</Text>
          <Text style={styles.metricLabel}>Doanh thu hôm nay</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{todayOrders.length}</Text>
          <Text style={styles.metricLabel}>Tổng đơn hôm nay</Text>
        </View>

        <Pressable
          style={[styles.metricCard, needsActionCount > 0 && styles.metricAlert]}
          onPress={onGoOrders}
        >
          <Text
            style={[
              styles.metricValue,
              needsActionCount > 0 && { color: colors.danger },
            ]}
          >
            {needsActionCount} 🔥
          </Text>
          <Text style={styles.metricLabel}>Đơn cần nấu ngay</Text>
        </Pressable>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{foods.length}</Text>
          <Text style={styles.metricLabel}>Món trong thực đơn</Text>
        </View>
      </View>

      {/* Action Center */}
      <Text style={styles.sectionTitle}>Hành động nhanh</Text>
      <View style={styles.actionPanel}>
        <Pressable style={styles.actionRow} onPress={onGoOrders}>
          <View style={styles.actionIconWrapper}>
            <Text style={styles.actionIcon}>📋</Text>
          </View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionTitle}>Hàng đợi đơn hàng</Text>
            <Text style={styles.actionSub}>
              {needsActionCount > 0
                ? `Có ${needsActionCount} đơn cần xử lý hoặc chuẩn bị bàn giao`
                : "Tất cả đơn hàng đều đã được xử lý"}
            </Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.actionRow} onPress={onGoMenu}>
          <View style={styles.actionIconWrapper}>
            <Text style={styles.actionIcon}>🍽️</Text>
          </View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionTitle}>Quản lý món & Topping</Text>
            <Text style={styles.actionSub}>
              Thêm món mới, chỉnh sửa giá bán và nhóm tùy chọn Size/Topping
            </Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.actionRow} onPress={onGoWallet}>
          <View style={styles.actionIconWrapper}>
            <Text style={styles.actionIcon}>💰</Text>
          </View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionTitle}>Ví doanh thu & Rút tiền</Text>
            <Text style={styles.actionSub}>
              Xem số dư tích lũy, quản lý tài khoản ngân hàng và gửi yêu cầu rút tiền
            </Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 100,
  },
  storeCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  storeLeft: {
    flex: 1,
    gap: 4,
  },
  storeName: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  statusIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  openToggleBtn: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricCard: {
    width: "48%",
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xxs,
  },
  metricAlert: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  metricValue: {
    ...typography.title1,
    color: colors.primary,
    fontWeight: "800",
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  actionPanel: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    gap: spacing.md,
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIcon: {
    fontSize: 22,
  },
  actionTextCol: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  actionSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  actionArrow: {
    fontSize: 22,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
});
