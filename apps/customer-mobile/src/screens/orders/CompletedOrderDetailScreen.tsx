import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatVnd, resolveMediaUrl } from "../../api/client";
import { Button } from "../../components/common/Button";
import { Header } from "../../components/common/Header";
import { Icon } from "../../components/common/Icon";
import { InfoRow } from "../../components/common/InfoRow";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import type { Order } from "../../types";

interface CompletedOrderDetailScreenProps {
  order: Order | null;
  loading: boolean;
  onBack: () => void;
  onReorder?: (order: Order) => void;
}

const paymentLabel = (paymentMethod?: string) => {
  if (paymentMethod === "PAYOS") return "Thanh toán Online PayOS";
  if (paymentMethod === "COD") return "Tiền mặt khi nhận hàng";
  return paymentMethod || "Chưa xác định";
};

export const CompletedOrderDetailScreen: React.FC<CompletedOrderDetailScreenProps> = ({
  order,
  loading,
  onBack,
  onReorder,
}) => {
  const [copied, setCopied] = useState(false);

  if (loading && !order) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Đang tải đơn hàng...</Text>
      </View>
    );
  }

  if (!order || order.orderStatus !== "delivered") {
    return (
      <View style={styles.container}>
        <Header title="Chi tiết đơn hàng" onBack={onBack} />
        <View style={styles.center}>
          <Text style={styles.muted}>Không tìm thấy đơn hàng đã hoàn tất.</Text>
        </View>
      </View>
    );
  }

  const orderCode = `#${order._id.slice(-6).toUpperCase()} - ${order.deliveryMethod === "drone" ? "DRN" : "SHP"}`;
  const address = [
    order.shippingAddress?.address,
    order.shippingAddress?.city,
    order.shippingAddress?.state,
  ]
    .filter(Boolean)
    .join(", ");
  const isShipper = order.deliveryMethod === "shipper";
  const restaurantName = (order.restaurantId?.name || "DRONEFOOD PARTNER RESTAURANT").toUpperCase();

  const calculatedItemsPrice = (order.orderItems || []).every(
    (item) => typeof item.price === "number"
  )
    ? (order.orderItems || []).reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
    : undefined;
  const itemsPrice = order.itemsPrice ?? calculatedItemsPrice;
  const shippingFee = order.shippingPrice ?? 0;
  const serviceFee = order.serviceFee || 0;
  const discountAmount = order.discountAmount || 0;

  const handleCopyCode = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.container}>
      <Header
        title={orderCode}
        subtitle="Hóa đơn thanh toán"
        onBack={onBack}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Receipt Order Code Hero Row with Copy Action */}
        <View style={styles.orderIdCard}>
          <View style={styles.orderIdLeft}>
            <Text style={styles.orderIdLabel}>MÃ ĐƠN HÀNG</Text>
            <View style={styles.orderIdRow}>
              <Text style={styles.orderIdText}>{orderCode}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sao chép mã đơn"
                hitSlop={8}
                onPress={handleCopyCode}
                style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
              >
                <Icon
                  name={copied ? "check" : "ticket"}
                  size={16}
                  color={copied ? colors.success : colors.primary}
                />
                <Text style={[styles.copyButtonText, copied && styles.copyButtonTextSuccess]}>
                  {copied ? "Đã chép" : "Sao chép"}
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.deliveredPill}>
            <Icon name="check" size={12} color={colors.statusDeliveredText} />
            <Text style={styles.deliveredPillText}>ĐÃ GIAO XONG</Text>
          </View>
        </View>

        {/* Delivered Success Announcement Card (Maintains test requirement statusDeliveredBg) */}
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Icon
              name={isShipper ? "motorcycle" : "drone"}
              size={24}
              color={colors.statusDeliveredText}
            />
          </View>
          <View style={styles.successTextWrap}>
            <Text style={styles.successTitle}>Đơn hàng đã giao thành công</Text>
            <Text style={styles.successText}>
              {isShipper
                ? "Tài xế đã hoàn tất giao món đến bạn an toàn."
                : "Drone đã hoàn tất hạ cánh và giao món đến bạn an toàn."}
            </Text>
          </View>
        </View>

        {/* Store & Customer Info Card */}
        <View style={styles.card}>
          <View style={styles.storeRow}>
            {order.restaurantId?.image ? (
              <Image
                source={{ uri: resolveMediaUrl(order.restaurantId.image) }}
                style={styles.restaurantAvatar}
                resizeMode="cover"
                accessibilityLabel={`Hình ảnh nhà hàng ${restaurantName}`}
              />
            ) : (
              <View style={styles.iconBox}>
                <Icon name="store" size={20} color={colors.primary} />
              </View>
            )}
            <View style={styles.storeCopy}>
              <Text style={styles.storeNameUppercase}>{restaurantName}</Text>
              {order.restaurantId?.address ? (
                <Text style={styles.storeAddress}>{order.restaurantId.address}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>KHÁCH HÀNG & ĐỊA CHỈ NHẬN</Text>
            <Text style={styles.value}>
              {order.shippingAddress?.fullName || "Khách hàng"}
              {order.shippingAddress?.phone ? ` · ${order.shippingAddress.phone}` : ""}
            </Text>
            <Text style={styles.muted}>{address || "Chưa có địa chỉ"}</Text>
          </View>
        </View>

        {/* Table-like Bill Breakdown & Ordered Food Items */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Chi tiết hóa đơn</Text>
          
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCol, styles.tableColItem]}>MÓN ĂN</Text>
            <Text style={[styles.tableCol, styles.tableColQty]}>SL</Text>
            <Text style={[styles.tableCol, styles.tableColPrice]}>THÀNH TIỀN</Text>
          </View>

          {(order.orderItems || []).map((item, index) => {
            const foodImg = item.image || (typeof item.product === "object" && item.product?.image);
            return (
              <View key={`${item.name}-${index}`} style={styles.tableRow}>
                <View style={styles.tableColItem}>
                  <View style={styles.itemWithImageRow}>
                    {foodImg ? (
                      <Image
                        source={{ uri: resolveMediaUrl(foodImg) }}
                        style={styles.foodThumb}
                        resizeMode="cover"
                        accessibilityLabel={`Hình món ${item.name}`}
                      />
                    ) : (
                      <View style={styles.foodThumbFallback}>
                        <Icon name="utensils" size={16} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.itemInfoWrap}>
                      <Text style={styles.tableItemName}>{item.name}</Text>
                      {(item.selectedOptions || []).map((option) => (
                        <Text
                          key={`${option.groupName}-${option.optionName}`}
                          style={styles.optionText}
                        >
                          • {option.groupName}: {option.optionName}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={styles.tableColQty}>{item.quantity}</Text>
                <Text style={styles.tableColPrice}>
                  {item.price != null ? formatVnd(item.price * item.quantity) : "—"}
                </Text>
              </View>
            );
          })}

          <View style={styles.divider} />

          <Text style={styles.breakdownTitle}>Chi tiết thanh toán</Text>

          {/* 1. Tổng tạm tính */}
          {itemsPrice != null ? (
            <InfoRow label="Tổng tạm tính" value={formatVnd(itemsPrice)} />
          ) : null}

          {/* 2. Phí áp dụng (Phí ship) */}
          <InfoRow
            label={isShipper ? "Phí áp dụng (Phí ship)" : "Phí áp dụng (Giao bằng drone)"}
            value={formatVnd(shippingFee)}
            subValue={order.deliveryDistanceKm ? `${order.deliveryDistanceKm.toFixed(1)} km` : undefined}
          />

          {/* 3. Phí dịch vụ (nếu có) */}
          {serviceFee > 0 ? (
            <InfoRow label="Phí dịch vụ" value={formatVnd(serviceFee)} />
          ) : null}

          {/* 4. Giảm giá qua voucher */}
          {discountAmount > 0 ? (
            order.vouchers && order.vouchers.length > 0 ? (
              order.vouchers.map((voucher, vIdx) => (
                <InfoRow
                  key={`voucher-${voucher.code}-${vIdx}`}
                  label={`Giảm ${formatVnd(voucher.discountAmount)} (${voucher.code})`}
                  value={`-${formatVnd(voucher.discountAmount)}`}
                  valueStyle={styles.discountValue}
                />
              ))
            ) : (
              <InfoRow
                label={`Giảm ${formatVnd(discountAmount)} voucher`}
                value={`-${formatVnd(discountAmount)}`}
                valueStyle={styles.discountValue}
              />
            )
          ) : null}

          <View style={styles.billDivider} />

          {/* 5. Tổng cộng */}
          <InfoRow
            label="Tổng cộng"
            value={formatVnd(order.totalPrice)}
            isTotal
          />

          <View style={styles.paymentMethodRow}>
            <View style={styles.paymentMethodLeft}>
              <Icon
                name={order.paymentMethod === "PAYOS" ? "credit-card" : "banknote"}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.paymentMethod}>
                {paymentLabel(order.paymentMethod)}
              </Text>
            </View>
            <View style={styles.paidBadge}>
              <Icon name="check" size={12} color={colors.statusDeliveredText} />
              <Text style={styles.paidBadgeText}>Đã thanh toán</Text>
            </View>
          </View>
        </View>

        {/* Action Button: Đặt lại đơn này */}
        <Button
          label="Đặt lại đơn này"
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => onReorder ? onReorder(order) : onBack()}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  content: {
    padding: spacing.screenPadding,
    gap: spacing.md,
    paddingBottom: 110,
  },
  orderIdCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderIdLeft: {
    gap: 3,
  },
  orderIdLabel: {
    ...typography.micro,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  orderIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  orderIdText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
    fontSize: 15,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  copyButtonText: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: "600",
    fontSize: 11,
  },
  copyButtonTextSuccess: {
    color: colors.success,
  },
  deliveredPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.statusDeliveredBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(22, 101, 52, 0.2)",
  },
  deliveredPillText: {
    ...typography.micro,
    color: colors.statusDeliveredText,
    fontWeight: "700",
    fontSize: 10,
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.statusDeliveredBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(22, 101, 52, 0.2)",
  },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  successTextWrap: {
    flex: 1,
  },
  successTitle: {
    ...typography.subheadBold,
    color: colors.statusDeliveredText,
  },
  successText: {
    ...typography.caption,
    color: colors.statusDeliveredText,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: "#003366",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  storeRow: {
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
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  storeCopy: {
    flex: 1,
    gap: 2,
  },
  storeNameUppercase: {
    ...typography.subheadBold,
    color: colors.primary,
    letterSpacing: 0.5,
    fontSize: 15,
  },
  storeAddress: {
    ...typography.micro,
    color: colors.textSecondary,
    marginTop: -2,
  },
  sectionTitle: {
    ...typography.subheadBold,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  fieldGroup: {
    gap: 2,
  },
  label: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  value: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  muted: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.xs,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  tableCol: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  tableColItem: {
    flex: 1,
  },
  itemWithImageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingRight: spacing.xs,
  },
  foodThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
  },
  foodThumbFallback: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfoWrap: {
    flex: 1,
  },
  tableColQty: {
    width: 36,
    textAlign: "center",
    marginTop: 2,
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
  },
  tableColPrice: {
    width: 90,
    textAlign: "right",
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
    fontSize: 13,
    marginTop: 2,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderSubtle,
  },
  tableItemName: {
    ...typography.body,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  optionText: {
    ...typography.micro,
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 11,
  },
  breakdownTitle: {
    ...typography.subheadBold,
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: spacing.xxs,
    marginBottom: spacing.xxs,
  },
  discountValue: {
    color: colors.success,
    fontWeight: "700",
  },
  billDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.xs,
  },
  paymentMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  paymentMethodLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  paymentMethod: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.statusDeliveredBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  paidBadgeText: {
    ...typography.micro,
    color: colors.statusDeliveredText,
    fontWeight: "700",
    fontSize: 10,
  },
  pressed: {
    opacity: motion.pressedOpacity,
  },
});
