import React, { useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { Header } from "../../components/common/Header";
import { Icon } from "../../components/common/Icon";
import { OrderReviewModal } from "../../components/orders/OrderReviewModal";
import type { Order, ReviewFlow } from "../../types";

interface OrdersScreenProps {
  orders: Order[];
  loading: boolean;
  onRefresh: () => void;
  onTrackOrder: (order: Order) => void;
  onReviewFlowChanged: (orderId: string, updatedFlow: ReviewFlow) => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  orders,
  loading,
  onRefresh,
  onTrackOrder,
  onReviewFlowChanged,
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
            <View style={styles.emptyIcon}><Icon name="package" size={52} color={colors.primary} /></View>
            <Text style={styles.emptyTitle}>
              {loading ? "Đang tải đơn hàng..." : "Chưa có đơn hàng nào"}
            </Text>
            <Text style={styles.emptyText}>
              Các đơn hàng của bạn sẽ xuất hiện tại đây sau khi đặt món.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isActive = ["pending", "preparing", "delivering", "arrived_at_delivery"].includes(
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
                <Icon name="store" size={16} color={colors.textSecondary} />
                <Text numberOfLines={1} style={styles.restaurantName}>
                  {item.restaurantId?.name || "Nhà hàng đối tác"}
                </Text>
              </View>

              {item.shippingAddress ? (
                <View style={styles.addressRow}>
                  <Icon name="map-pin" size={14} color={colors.textSecondary} />
                  <Text numberOfLines={1} style={styles.addressText}>{item.shippingAddress.address}, {item.shippingAddress.city}</Text>
                </View>
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

              {item.orderStatus === "delivered" && item.reviewFlow?.complete ? (
                <View style={styles.reviewCompleteRow}>
                  <Icon name="check" size={15} color="#15803D" />
                  <Text style={styles.reviewCompleteText}>
                    Đã gửi đánh giá đơn hàng
                  </Text>
                </View>
              ) : null}

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
                    label={isDrone ? "Theo dõi Drone" : "Xem chi tiết"}
                    icon={isDrone ? <Icon name="drone" size={16} color="#FFFFFF" /> : undefined}
                    variant={isDrone ? "primary" : "secondary"}
                    style={styles.actionBtn}
                    onPress={() => onTrackOrder(item)}
                  />
                ) : item.orderStatus === "delivered" ? (
                  <View style={styles.deliveredActions}>
                    {item.reviewFlow?.nextTarget ? (
                      <Button
                        label="Đánh giá"
                        variant="secondary"
                        style={styles.reviewActionBtn}
                        onPress={() => setSelectedReviewOrder(item)}
                      />
                    ) : null}
                    <Button
                      label="Chi tiết đơn"
                      variant="outline"
                      style={styles.actionBtn}
                      onPress={() => onTrackOrder(item)}
                    />
                  </View>
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
          onReviewFlowChanged(orderId, updatedFlow);
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
    width: 16,
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
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  deliveredActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  reviewActionBtn: {
    minWidth: 88,
    minHeight: 38,
    paddingHorizontal: spacing.sm,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
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
  reviewCompleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: spacing.xxs,
  },
  reviewCompleteText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#15803D",
  },
});
