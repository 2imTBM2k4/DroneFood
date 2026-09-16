import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import type { Order } from "../../types";

interface OrderCardProps {
  order: Order;
  working: boolean;
  onAcceptAndPrepare: (order: Order) => void;
  onDroneHandover: (order: Order) => void;
  onCancel: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  working,
  onAcceptAndPrepare,
  onDroneHandover,
  onCancel,
}) => {
  const isDrone = order.deliveryMethod === "drone";
  const canCancel = order.orderStatus === "pending" || order.orderStatus === "preparing";

  const handleCallCustomer = () => {
    if (order.shippingAddress.phone) {
      Linking.openURL(`tel:${order.shippingAddress.phone}`);
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.orderId}>
            #{order._id.slice(-6).toUpperCase()}
          </Text>
          <Text style={styles.orderTime}>
            {new Date(order.createdAt).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View style={styles.badgeGroup}>
          <Badge status={isDrone ? "drone" : "shipper"} />
          <Badge status={order.orderStatus} />
        </View>
      </View>

      {/* Customer Info */}
      <View style={styles.customerBox}>
        <View style={styles.customerHeader}>
          <Text style={styles.customerName}>
            👤 {order.shippingAddress.fullName}
          </Text>
          {order.shippingAddress.phone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gọi khách"
              style={styles.callBtn}
              onPress={handleCallCustomer}
            >
              <Text style={styles.callText}>📞 {order.shippingAddress.phone}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text numberOfLines={2} style={styles.customerAddress}>
          📍 {[
            order.shippingAddress.address,
            order.shippingAddress.city,
            order.shippingAddress.state,
          ]
            .filter(Boolean)
            .join(", ")}
        </Text>
      </View>

      {/* Food Items Ordered */}
      <View style={styles.itemsBox}>
        <Text style={styles.itemsTitle}>Món cần chuẩn bị ({order.orderItems.length}):</Text>
        {order.orderItems.map((item, index) => (
          <View key={`${item.name}-${index}`} style={styles.itemRow}>
            <View style={styles.itemMain}>
              <Text style={styles.itemCount}>
                <Text style={styles.qtyBadge}>{item.quantity}x</Text> {item.name}
              </Text>
              {item.selectedOptions?.map((opt) => (
                <Text
                  key={`${opt.groupName}-${opt.optionName}`}
                  style={styles.optionDetail}
                >
                  • {opt.groupName}: {opt.optionName}
                </Text>
              ))}
              {item.note ? (
                <Text style={styles.itemNote}>📝 Ghi chú: {item.note}</Text>
              ) : null}
            </View>
            {item.price ? (
              <Text style={styles.itemPriceText}>
                {formatVnd(item.price * item.quantity)}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* Total & Payment */}
      <View style={styles.footerRow}>
        <View>
          <Text style={styles.totalLabel}>Tổng tiền đơn</Text>
          <Text style={styles.totalAmount}>{formatVnd(order.totalPrice)}</Text>
        </View>
        <Text style={styles.paymentMethod}>
          {order.paymentMethod === "PAYOS" ? "Đã thanh toán Online ✓" : "Thu tiền mặt COD"}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {order.orderStatus === "pending" ? (
          <Button
            label="✅ Nhận đơn & Bắt đầu nấu"
            variant="success"
            disabled={working}
            onPress={() => onAcceptAndPrepare(order)}
          />
        ) : null}

        {order.orderStatus === "preparing" && isDrone ? (
          <Button
            label="🛸 Bàn giao cho Drone bay"
            variant="primary"
            disabled={working}
            onPress={() => onDroneHandover(order)}
          />
        ) : null}

        {order.orderStatus === "preparing" && !isDrone ? (
          <View style={styles.shipperNotice}>
            <Text style={styles.shipperNoticeText}>
              🛵 Đơn đang nấu. Chờ Shipper đến lấy và tự xác nhận.
            </Text>
          </View>
        ) : null}

        {canCancel ? (
          <Button
            label="Từ chối / Hủy đơn"
            variant="outline"
            disabled={working}
            onPress={() => onCancel(order)}
          />
        ) : null}

        {order.reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText}>Lý do: {order.reason}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderId: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  orderTime: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  badgeGroup: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  customerBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  customerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerName: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  callBtn: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  callText: {
    ...typography.micro,
    color: "#15803D",
    fontWeight: "700",
  },
  customerAddress: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  itemsBox: {
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  itemsTitle: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 2,
  },
  itemMain: {
    flex: 1,
  },
  itemCount: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  qtyBadge: {
    color: colors.primary,
    fontWeight: "800",
  },
  optionDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  itemNote: {
    ...typography.caption,
    color: colors.primaryDark,
    fontStyle: "italic",
    marginLeft: spacing.sm,
  },
  itemPriceText: {
    ...typography.subhead,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  totalAmount: {
    ...typography.title1,
    color: colors.primary,
    fontWeight: "800",
  },
  paymentMethod: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  actionsContainer: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  shipperNotice: {
    backgroundColor: "#FEF3C7",
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  shipperNoticeText: {
    ...typography.caption,
    color: "#92400E",
    textAlign: "center",
  },
  reasonBox: {
    backgroundColor: colors.statusCancelledBg,
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  reasonText: {
    ...typography.caption,
    color: colors.statusCancelledText,
  },
});
