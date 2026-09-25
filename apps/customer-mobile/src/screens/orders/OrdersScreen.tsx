import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { formatVnd } from "../../api/client";
import { Badge } from "../../components/common/Badge";
import { GlassSurface } from "../../components/common/GlassSurface";
import { Header } from "../../components/common/Header";
import { Icon } from "../../components/common/Icon";
import { OrderReviewModal } from "../../components/orders/OrderReviewModal";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { Order, ReviewFlow } from "../../types";

interface OrdersScreenProps {
  orders: Order[];
  loading: boolean;
  onRefresh: () => void;
  onTrackOrder: (order: Order) => void;
  onReviewFlowChanged: (orderId: string, updatedFlow: ReviewFlow) => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({ orders, loading, onRefresh, onTrackOrder, onReviewFlowChanged }) => {
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const sorted = useMemo(() => [...orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [orders]);

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
        ListEmptyComponent={(
          <GlassSurface tone="strong" contentStyle={styles.empty}>
            <View style={styles.emptyIcon}><Icon name={loading ? "refresh" : "package"} size={34} color={colors.primary} /></View>
            <Text style={styles.emptyTitle}>{loading ? "Đang tải đơn hàng..." : "Chưa có đơn hàng"}</Text>
            <Text style={styles.emptyText}>Đơn mới sẽ xuất hiện ở đây để bạn theo dõi theo thời gian thực.</Text>
          </GlassSurface>
        )}
        renderItem={({ item }) => {
          const active = ["pending", "preparing", "delivering", "arrived_at_delivery"].includes(item.orderStatus);
          const drone = item.deliveryMethod === "drone";
          return (
            <GlassSurface tone="strong" contentStyle={styles.card}>
              <View style={styles.cardTop}>
                <View><Text style={styles.code}>#{item._id.slice(-6).toUpperCase()}</Text><Text style={styles.date}>{new Date(item.createdAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</Text></View>
                <Badge status={item.orderStatus} />
              </View>

              <View style={styles.restaurantRow}><View style={styles.iconBox}><Icon name="store" size={17} color={colors.primary} /></View><View style={styles.restaurantCopy}><Text numberOfLines={1} style={styles.restaurantName}>{item.restaurantId?.name || "Nhà hàng đối tác"}</Text>{item.shippingAddress?.address ? <Text numberOfLines={1} style={styles.address}>{item.shippingAddress.address}, {item.shippingAddress.city}</Text> : null}</View></View>

              <View style={styles.itemsBox}>
                {(item.orderItems || []).slice(0, 3).map((food, index) => <View key={`${food.name}-${index}`} style={styles.foodRow}><Text numberOfLines={1} style={styles.foodName}>{food.name}</Text><Text style={styles.foodQuantity}>× {food.quantity}</Text></View>)}
                {(item.orderItems || []).length > 3 ? <Text style={styles.more}>+{(item.orderItems || []).length - 3} món khác</Text> : null}
              </View>

              <View style={styles.cardBottom}>
                <View><Text style={styles.total}>{formatVnd(item.totalPrice)}</Text><View style={styles.method}><Icon name={drone ? "drone" : "motorcycle"} size={14} color={colors.primary} /><Text style={styles.methodText}>{drone ? "Drone" : "Shipper"}</Text></View></View>
                <View style={styles.actions}>
                  {item.orderStatus === "delivered" && item.reviewFlow?.nextTarget ? <Pressable style={styles.secondaryAction} onPress={() => setReviewOrder(item)}><Text style={styles.secondaryActionText}>Đánh giá</Text></Pressable> : null}
                  <Pressable style={[styles.primaryAction, !active && styles.outlineAction]} onPress={() => onTrackOrder(item)}><Text style={[styles.primaryActionText, !active && styles.outlineActionText]}>{active ? "Theo dõi" : "Chi tiết"}</Text><Icon name="chevron-right" size={15} color={active ? colors.textWhite : colors.primary} /></Pressable>
                </View>
              </View>
            </GlassSurface>
          );
        }}
      />
      <OrderReviewModal visible={Boolean(reviewOrder)} order={reviewOrder} onClose={() => setReviewOrder(null)} onReviewCompleted={(orderId, updatedFlow) => { if (reviewOrder?._id === orderId) setReviewOrder({ ...reviewOrder, reviewFlow: updatedFlow }); onReviewFlowChanged(orderId, updatedFlow); onRefresh(); }} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  list: { padding: spacing.md, paddingBottom: 132, gap: spacing.md },
  empty: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  emptyTitle: { ...typography.title1, color: colors.textPrimary },
  emptyText: { ...typography.bodySecondary, color: colors.textSecondary, textAlign: "center", maxWidth: 280 },
  card: { padding: spacing.lg, gap: spacing.md },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md },
  code: { ...typography.subheadBold, color: colors.textPrimary },
  date: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  restaurantRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBox: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight },
  restaurantCopy: { flex: 1 },
  restaurantName: { ...typography.subheadBold, color: colors.textPrimary },
  address: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  itemsBox: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
  foodRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  foodName: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  foodQuantity: { ...typography.captionBold, color: colors.textSecondary },
  more: { ...typography.caption, color: colors.primary, marginTop: 2 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  total: { ...typography.title2, color: colors.primary },
  method: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  methodText: { ...typography.micro, color: colors.textSecondary },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  primaryAction: { minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.primary, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: 4 },
  primaryActionText: { ...typography.captionBold, color: colors.textWhite },
  outlineAction: { backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.primary },
  outlineActionText: { color: colors.primary },
  secondaryAction: { minHeight: 44, borderRadius: radius.pill, paddingHorizontal: spacing.md, justifyContent: "center", backgroundColor: colors.primaryLight },
  secondaryActionText: { ...typography.captionBold, color: colors.primary },
});
