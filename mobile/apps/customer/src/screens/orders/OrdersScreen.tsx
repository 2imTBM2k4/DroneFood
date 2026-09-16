import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { Header } from "../../components/common/Header";
import { OrderReviewModal } from "../../components/orders/OrderReviewModal";
import type { Order } from "../../types";

interface OrdersScreenProps {
  orders: Order[];
  loading: boolean;
  onRefresh: () => void;
  onTrackOrder: (order: Order) => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  orders,
  loading,
  onRefresh,
  onTrackOrder,
}) => {
  const [selectedReviewOrder, setSelectedReviewOrder] = useState<Order | null>(null);

  const sortedOrders = useMemo(() => {
    return [...orders].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
    );
  }, [orders]);

  return (
    <View style={styles.container}>
      <Header title="Lịch sử đơn hàng" />

      <FlatList
        data={sortedOrders}
        keyExtractor={(item) => item._id}
        onRefresh={onRefresh}
        refreshing={loading}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>
              {loading ? "Đang tải đơn hàng..." : "Chưa có đơn hàng nào"}
            </Text>
            <Text style={styles.emptyText}>
              Các đơn hàng của bạn sẽ xuất hiện tại đây sau khi đặt món.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isActive = ["pending", "preparing", "delivering"].includes(
            item.orderStatus
          );
          const isDrone = item.deliveryMethod === "drone";

          return (
            <View style={styles.orderCard}>
              <View style={styles.orderCardHeader}>
                <View>
                  <Text style={styles.orderCode}>
                    #{item._id.slice(-6).toUpperCase()}
                  </Text>
                  <Text style={styles.orderDate}>
                    {new Date(item.createdAt).toLocaleString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </Text>
                </View>
                <Badge status={item.orderStatus} />
              </View>

              <View style={styles.restaurantRow}>
                <Text style={styles.storeIcon}>🏪</Text>
                <Text numberOfLines={1} style={styles.restaurantName}>
                  {item.restaurantId?.name || "Nhà hàng đối tác"}
                </Text>
              </View>

              {item.shippingAddress ? (
                <Text numberOfLines={1} style={styles.addressText}>
                  📍 {item.shippingAddress.address}, {item.shippingAddress.city}
                </Text>
              ) : null}

              <View style={styles.itemsSummary}>
                {(item.orderItems || []).map((foodItem, i) => (
                  <Text
                    key={`${foodItem.name}-${i}`}
                    numberOfLines={1}
                    style={styles.foodLine}
                  >
                    • {foodItem.name} × {foodItem.quantity}
                  </Text>
                ))}
              </View>

              {item.orderStatus === "delivered" && (
                <View style={styles.reviewBanner}>
                  {item.reviewFlow?.complete ? (
                    <View style={styles.reviewCompleteRow}>
                      <Text style={styles.reviewCompleteCheck}>✓</Text>
                      <Text style={styles.reviewCompleteText}>
                        Đã gửi đánh giá đơn hàng
                      </Text>
                    </View>
                  ) : item.reviewFlow?.nextTarget ? (
                    <View style={styles.reviewPromptRow}>
                      <View style={styles.reviewPromptTextCol}>
                        <Text style={styles.reviewPromptTitle}>
                          Đã giao thành công
                        </Text>
                        <Text style={styles.reviewPromptSub} numberOfLines={1}>
                          Đánh giá {item.reviewFlow.nextTarget.targetType === "shipper" ? "tài xế" : "món ăn"}: {item.reviewFlow.nextTarget.name}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.reviewPromptBtn}
                        onPress={() => setSelectedReviewOrder(item)}
                      >
                        <Text style={styles.reviewPromptBtnText}>Đánh giá ⭐</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )}

              <View style={styles.orderCardFooter}>
                <View>
                  <Text style={styles.totalPrice}>
                    {formatVnd(item.totalPrice)}
                  </Text>
                  <Badge
                    status={isDrone ? "drone" : "shipper"}
                    style={styles.deliveryBadge}
                  />
                </View>

                {isActive ? (
                  <Button
                    label={isDrone ? "🛸 Theo dõi Drone" : "Xem chi tiết"}
                    variant={isDrone ? "primary" : "secondary"}
                    style={styles.actionBtn}
                    onPress={() => onTrackOrder(item)}
                  />
                ) : (
                  <Button
                    label="Chi tiết đơn"
                    variant="outline"
                    style={styles.actionBtn}
                    onPress={() => onTrackOrder(item)}
                  />
                )}
              </View>
            </View>
          );
        }}
      />

      <OrderReviewModal
        visible={Boolean(selectedReviewOrder)}
        order={selectedReviewOrder}
        onClose={() => setSelectedReviewOrder(null)}
        onReviewCompleted={(orderId, updatedFlow) => {
          if (selectedReviewOrder && selectedReviewOrder._id === orderId) {
            setSelectedReviewOrder({ ...selectedReviewOrder, reviewFlow: updatedFlow });
          }
          onRefresh();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  tabBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 110,
  },
  orderCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  orderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderCode: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  orderDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  restaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 2,
  },
  storeIcon: {
    fontSize: 14,
  },
  restaurantName: {
    ...typography.captionBold,
    color: colors.textPrimary,
    flex: 1,
  },
  addressText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  itemsSummary: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
    marginVertical: spacing.xxs,
  },
  foodLine: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  orderCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xxs,
  },
  totalPrice: {
    ...typography.title2,
    color: colors.primary,
  },
  deliveryBadge: {
    marginTop: 2,
  },
  actionBtn: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 56,
  },
  emptyTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  emptyText: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
    textAlign: "center",
  },
  reviewBanner: {
    marginVertical: spacing.xs,
    padding: spacing.sm,
    backgroundColor: "#FEF3C7",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  reviewCompleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewCompleteCheck: {
    color: "#16A34A",
    fontWeight: "800",
    fontSize: 14,
  },
  reviewCompleteText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#15803D",
  },
  reviewPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  reviewPromptTextCol: {
    flex: 1,
  },
  reviewPromptTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  reviewPromptSub: {
    fontSize: 12,
    color: "#B45309",
    marginTop: 1,
  },
  reviewPromptBtn: {
    backgroundColor: "#D97706",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewPromptBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});
