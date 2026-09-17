import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { formatVnd } from "../../api/client";
import { Header } from "../../components/common/Header";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { Order } from "../../types";

interface CompletedOrderDetailScreenProps {
  order: Order | null;
  loading: boolean;
  onBack: () => void;
}

const paymentLabel = (paymentMethod?: string) => {
  if (paymentMethod === "PAYOS") return "Thanh toán Online PayOS";
  if (paymentMethod === "COD") return "Tiền mặt khi nhận hàng";
  return paymentMethod || "Chưa xác định";
};

export const CompletedOrderDetailScreen: React.FC<CompletedOrderDetailScreenProps> = ({ order, loading, onBack }) => {
  if (loading && !order) {
    return <View style={styles.center}><Text style={styles.muted}>Đang tải đơn hàng...</Text></View>;
  }

  if (!order || order.orderStatus !== "delivered") {
    return <View style={styles.container}><Header title="Chi tiết đơn hàng" onBack={onBack} /><View style={styles.center}><Text style={styles.muted}>Không tìm thấy đơn hàng đã hoàn tất.</Text></View></View>;
  }

  const address = [order.shippingAddress?.address, order.shippingAddress?.city, order.shippingAddress?.state]
    .filter(Boolean)
    .join(", ");
  const isShipper = order.deliveryMethod === "shipper";

  return <View style={styles.container}>
    <Header title={`Đơn #${order._id.slice(-6).toUpperCase()}`} subtitle="Đã giao thành công" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.successCard}>
        <Text style={styles.successIcon}>{isShipper ? "🛵" : "🛸"}</Text>
        <View style={styles.successTextWrap}>
          <Text style={styles.successTitle}>Đơn hàng đã giao thành công</Text>
          <Text style={styles.successText}>{isShipper ? "Tài xế đã hoàn tất giao món đến bạn." : "Drone đã hoàn tất giao món đến bạn."}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Thông tin giao hàng</Text>
        <Text style={styles.label}>Nhà hàng</Text>
        <Text style={styles.value}>{order.restaurantId?.name || "Nhà hàng đối tác"}</Text>
        {order.restaurantId?.address ? <Text style={styles.muted}>{order.restaurantId.address}</Text> : null}
        <View style={styles.divider} />
        <Text style={styles.label}>Địa chỉ nhận hàng</Text>
        <Text style={styles.value}>{order.shippingAddress?.fullName || "Khách hàng"}{order.shippingAddress?.phone ? ` · ${order.shippingAddress.phone}` : ""}</Text>
        <Text style={styles.muted}>{address || "Chưa có địa chỉ"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Món đã đặt</Text>
        {(order.orderItems || []).map((item, index) => (
          <View key={`${item.name}-${index}`} style={styles.itemRow}>
            <View style={styles.itemTextWrap}>
              <Text style={styles.value}>{item.name} × {item.quantity}</Text>
              {(item.selectedOptions || []).map((option) => <Text key={`${option.groupName}-${option.optionName}`} style={styles.optionText}>• {option.groupName}: {option.optionName}</Text>)}
            </View>
            {item.price != null ? <Text style={styles.itemPrice}>{formatVnd(item.price * item.quantity)}</Text> : null}
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.totalRow}><Text style={styles.label}>Tổng thanh toán</Text><Text style={styles.total}>{formatVnd(order.totalPrice)}</Text></View>
        <Text style={styles.muted}>Hình thức: {paymentLabel(order.paymentMethod)}</Text>
      </View>
    </ScrollView>
  </View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parchment },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg, backgroundColor: colors.parchment },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 110 },
  successCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.statusDeliveredBg, borderWidth: 1, borderColor: "#86EFAC" },
  successIcon: { fontSize: 30 },
  successTextWrap: { flex: 1 },
  successTitle: { ...typography.title2, color: colors.statusDeliveredText },
  successText: { ...typography.bodySecondary, color: colors.statusDeliveredText, marginTop: 3 },
  card: { backgroundColor: colors.surfaceCard, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { ...typography.title2, color: colors.textPrimary, marginBottom: spacing.xs },
  label: { ...typography.captionBold, color: colors.textSecondary },
  value: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  muted: { ...typography.bodySecondary, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, paddingVertical: spacing.xs },
  itemTextWrap: { flex: 1 },
  optionText: { ...typography.bodySecondary, color: colors.textSecondary, marginTop: 2 },
  itemPrice: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  total: { ...typography.title2, color: colors.primary },
});
