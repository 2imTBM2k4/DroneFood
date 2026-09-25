import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { formatVnd } from "../../api/client";
import { Header } from "../../components/common/Header";
import { GlassSurface } from "../../components/common/GlassSurface";
import { Icon } from "../../components/common/Icon";
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
      <GlassSurface tone="soft" contentStyle={styles.successCard}>
        <View style={styles.successIcon}><Icon name={isShipper ? "motorcycle" : "drone"} size={25} color={colors.primary} /></View>
        <View style={styles.successTextWrap}>
          <Text style={styles.successTitle}>Đơn hàng đã giao thành công</Text>
          <Text style={styles.successText}>{isShipper ? "Tài xế đã hoàn tất giao món đến bạn." : "Drone đã hoàn tất giao món đến bạn."}</Text>
        </View>
      </GlassSurface>

      <GlassSurface tone="strong" contentStyle={styles.card}>
        <Text style={styles.sectionTitle}>Thông tin giao hàng</Text>
        <Text style={styles.label}>Nhà hàng</Text>
        <Text style={styles.value}>{order.restaurantId?.name || "Nhà hàng đối tác"}</Text>
        {order.restaurantId?.address ? <Text style={styles.muted}>{order.restaurantId.address}</Text> : null}
        <View style={styles.divider} />
        <Text style={styles.label}>Địa chỉ nhận hàng</Text>
        <Text style={styles.value}>{order.shippingAddress?.fullName || "Khách hàng"}{order.shippingAddress?.phone ? ` · ${order.shippingAddress.phone}` : ""}</Text>
        <Text style={styles.muted}>{address || "Chưa có địa chỉ"}</Text>
      </GlassSurface>

      <GlassSurface tone="strong" contentStyle={styles.card}>
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
      </GlassSurface>
    </ScrollView>
  </View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg, backgroundColor: "transparent" },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 110 },
  successCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  successIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight },
  successTextWrap: { flex: 1 },
  successTitle: { ...typography.title2, color: colors.statusDeliveredText },
  successText: { ...typography.bodySecondary, color: colors.statusDeliveredText, marginTop: 3 },
  card: { padding: spacing.lg, gap: spacing.xs },
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
