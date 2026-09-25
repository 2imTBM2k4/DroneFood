import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { OrderCard } from "../../components/order/OrderCard";
import { CancelOrderModal } from "../../components/order/CancelOrderModal";
import type { Order, OrderStatus } from "../../types";

interface OrdersQueueScreenProps {
  orders: Order[];
  loading: boolean;
  working: boolean;
  onRefresh: () => void;
  onAcceptAndPrepare: (order: Order) => void;
  onDroneHandover: (order: Order) => void;
  onCancelConfirm: (order: Order, reason: string) => Promise<void>;
}

export const OrdersQueueScreen: React.FC<OrdersQueueScreenProps> = ({
  orders,
  loading,
  working,
  onRefresh,
  onAcceptAndPrepare,
  onDroneHandover,
  onCancelConfirm,
}) => {
  const [selectedTab, setSelectedTab] = useState<
    "pending" | "preparing" | "delivering" | "history"
  >("pending");
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  const pendingCount = orders.filter((o) => o.orderStatus === "pending").length;
  const preparingCount = orders.filter((o) => o.orderStatus === "preparing").length;
  const deliveringCount = orders.filter((o) => o.orderStatus === "delivering").length;

  const filteredOrders = useMemo(() => {
    const sorted = [...orders].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
    );
    if (selectedTab === "pending") {
      return sorted.filter((o) => o.orderStatus === "pending");
    }
    if (selectedTab === "preparing") {
      return sorted.filter((o) => o.orderStatus === "preparing");
    }
    if (selectedTab === "delivering") {
      return sorted.filter((o) => o.orderStatus === "delivering");
    }
    return sorted.filter((o) =>
      ["delivered", "cancelled"].includes(o.orderStatus)
    );
  }, [orders, selectedTab]);

  return (
    <View style={styles.container}>
      {/* Tab Segment Selector */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tabBtn, selectedTab === "pending" && styles.tabBtnActive]}
          onPress={() => setSelectedTab("pending")}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "pending" && styles.tabTextActive,
            ]}
          >
            Chờ duyệt {pendingCount > 0 ? `(${pendingCount})` : ""}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, selectedTab === "preparing" && styles.tabBtnActive]}
          onPress={() => setSelectedTab("preparing")}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "preparing" && styles.tabTextActive,
            ]}
          >
            Đang nấu {preparingCount > 0 ? `(${preparingCount})` : ""}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, selectedTab === "delivering" && styles.tabBtnActive]}
          onPress={() => setSelectedTab("delivering")}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "delivering" && styles.tabTextActive,
            ]}
          >
            Đang giao {deliveringCount > 0 ? `(${deliveringCount})` : ""}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, selectedTab === "history" && styles.tabBtnActive]}
          onPress={() => setSelectedTab("history")}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "history" && styles.tabTextActive,
            ]}
          >
            Lịch sử
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item._id}
        onRefresh={onRefresh}
        refreshing={loading}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🍳</Text>
            <Text style={styles.emptyTitle}>
              {loading
                ? "Đang cập nhật danh sách đơn..."
                : selectedTab === "pending"
                ? "Không có đơn nào đang chờ duyệt"
                : selectedTab === "preparing"
                ? "Không có đơn nào đang nấu"
                : selectedTab === "delivering"
                ? "Không có đơn nào đang trên đường giao"
                : "Chưa có đơn hàng trong lịch sử"}
            </Text>
            <Text style={styles.emptySub}>
              Đơn hàng mới từ khách sẽ tự động xuất hiện và phát chuông báo.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            working={working}
            onAcceptAndPrepare={onAcceptAndPrepare}
            onDroneHandover={onDroneHandover}
            onCancel={(order) => setCancellingOrder(order)}
          />
        )}
      />

      {/* Cancel Order Dialog */}
      <CancelOrderModal
        order={cancellingOrder}
        visible={Boolean(cancellingOrder)}
        onClose={() => setCancellingOrder(null)}
        onConfirm={async (order, reason) => {
          await onCancelConfirm(order, reason);
          setCancellingOrder(null);
        }}
        working={working}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 100,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.xs,
  },
  emptyIcon: {
    fontSize: 54,
  },
  emptyTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptySub: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
});
