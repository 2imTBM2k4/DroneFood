import React, { useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { formatVnd, resolveMediaUrl } from "../../api/client";
import { Badge } from "../../components/common/Badge";
import { Header } from "../../components/common/Header";
import { Icon } from "../../components/common/Icon";
import { OrderReviewModal } from "../../components/orders/OrderReviewModal";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
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
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const sorted = useMemo(
    () => [...orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [orders]
  );

  return (
    <View style={styles.screen}>
      <Header title="Đơn hàng" subtitle="Theo dõi và xem lại các đơn đã đặt" />
      <FlatList
        data={sorted}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Icon
                name={loading ? "refresh" : "package"}
                size={32}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {loading ? "Đang tải đơn hàng..." : "Chưa có đơn hàng"}
            </Text>
            <Text style={styles.emptyText}>
              Đơn mới sẽ xuất hiện ở đây để bạn theo dõi hành trình giao món theo thời gian thực.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const active = ["pending", "preparing", "delivering", "arrived_at_delivery"].includes(
            item.orderStatus
          );
          const isDrone = item.deliveryMethod === "drone";

          return (
            <View style={styles.card}>
              {/* Card Header: Order code & Status Badge */}
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.code}>#{item._id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.date}>
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

              {/* Restaurant info with image */}
              <View style={styles.restaurantRow}>
                {item.restaurantId?.image ? (
                  <Image
                    source={{ uri: resolveMediaUrl(item.restaurantId.image) }}
                    style={styles.restaurantAvatar}
                    resizeMode="cover"
                    accessibilityLabel={`Hình ảnh nhà hàng ${item.restaurantId.name || ""}`}
                  />
                ) : (
                  <View style={styles.iconBox}>
                    <Icon name="store" size={20} color={colors.primary} />
                  </View>
                )}
                <View style={styles.restaurantCopy}>
                  <Text numberOfLines={1} style={styles.restaurantName}>
                    {item.restaurantId?.name || "Nhà hàng đối tác"}
                  </Text>
                  {item.shippingAddress?.address ? (
                    <Text numberOfLines={1} style={styles.address}>
                      {item.shippingAddress.address}, {item.shippingAddress.city}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Items Summary Box with Food Thumbnails */}
              <View style={styles.itemsBox}>
                {(item.orderItems || []).slice(0, 3).map((food, index) => {
                  const foodImg = food.image || (typeof food.product === "object" && food.product?.image);
                  return (
                    <View key={`${food.name}-${index}`} style={styles.foodRow}>
                      {foodImg ? (
                        <Image
                          source={{ uri: resolveMediaUrl(foodImg) }}
                          style={styles.foodThumb}
                          resizeMode="cover"
                          accessibilityLabel={`Hình món ${food.name}`}
                        />
                      ) : (
                        <View style={styles.foodThumbFallback}>
                          <Icon name="utensils" size={14} color={colors.primary} />
                        </View>
                      )}
                      <Text numberOfLines={1} style={styles.foodName}>
                        {food.name}
                      </Text>
                      <Text style={styles.foodQuantity}>× {food.quantity}</Text>
                    </View>
                  );
                })}
                {(item.orderItems || []).length > 3 ? (
                  <Text style={styles.more}>
                    +{(item.orderItems || []).length - 3} món khác
                  </Text>
                ) : null}
              </View>

              {/* Card Footer: Total price, Method & Action Buttons */}
              <View style={styles.cardBottom}>
                <View>
                  <Text style={styles.total}>{formatVnd(item.totalPrice)}</Text>
                  <View style={styles.method}>
                    <Icon
                      name={isDrone ? "drone" : "motorcycle"}
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.methodText}>
                      {isDrone ? "Giao bằng Drone" : "Giao bằng Shipper"}
                    </Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  {item.orderStatus === "delivered" && item.reviewFlow?.nextTarget ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryAction,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Đánh giá đơn hàng"
                      onPress={() => setReviewOrder(item)}
                    >
                      <Text style={styles.secondaryActionText}>Đánh giá</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryAction,
                      !active && styles.outlineAction,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={active ? "Theo dõi đơn hàng" : "Xem chi tiết đơn hàng"}
                    onPress={() => onTrackOrder(item)}
                  >
                    <Text
                      style={[
                        styles.primaryActionText,
                        !active && styles.outlineActionText,
                      ]}
                    >
                      {active ? "Theo dõi" : "Chi tiết"}
                    </Text>
                    <Icon
                      name="chevron-right"
                      size={15}
                      color={active ? colors.textWhite : colors.primary}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      <OrderReviewModal
        visible={Boolean(reviewOrder)}
        order={reviewOrder}
        onClose={() => setReviewOrder(null)}
        onReviewCompleted={(orderId, updatedFlow) => {
          if (reviewOrder?._id === orderId) {
            setReviewOrder({ ...reviewOrder, reviewFlow: updatedFlow });
          }
          onReviewFlowChanged(orderId, updatedFlow);
          onRefresh();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    padding: spacing.screenPadding,
    paddingBottom: 132,
    gap: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  emptyText: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  code: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  date: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  restaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  restaurantAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  restaurantCopy: {
    flex: 1,
  },
  restaurantName: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  address: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemsBox: {
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  foodThumb: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  foodThumbFallback: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  foodName: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  foodQuantity: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  more: {
    ...typography.captionBold,
    color: colors.primary,
    marginTop: 2,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
  },
  total: {
    ...typography.price,
    fontSize: 17,
    color: colors.primary,
  },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  methodText: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  primaryAction: {
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  primaryActionText: {
    ...typography.captionBold,
    color: colors.textWhite,
  },
  outlineAction: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  outlineActionText: {
    color: colors.primary,
  },
  secondaryAction: {
    minHeight: 44,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
  },
  secondaryActionText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
});
