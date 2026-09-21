import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Button } from "../../components/common/Button";
import { Header } from "../../components/common/Header";
import { Icon } from "../../components/common/Icon";
import type { Cart, CartLine } from "../../types";

interface CartScreenProps {
  cart?: Cart;
  loading: boolean;
  onUpdateQuantity: (line: CartLine, quantity: number) => Promise<void>;
  onClearCart: () => Promise<void>;
  onProceedCheckout: () => void;
  onExploreFood: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({
  cart,
  loading,
  onUpdateQuantity,
  onClearCart,
  onProceedCheckout,
  onExploreFood,
}) => {
  const items = cart?.items || [];
  const subtotal = cart?.subtotal || 0;

  const handleClear = () => {
    Alert.alert(
      "Xóa giỏ hàng",
      "Bạn có chắc muốn xóa tất cả món trong giỏ hàng?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa hết",
          style: "destructive",
          onPress: onClearCart,
        },
      ]
    );
  };

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="Giỏ hàng của bạn" />
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}><Icon name="cart" size={56} color={colors.primary} /></View>
          <Text style={styles.emptyTitle}>Giỏ hàng đang trống</Text>
          <Text style={styles.emptySubtitle}>
            Hãy khám phá các nhà hàng ngon xung quanh và chọn món ngay thôi!
          </Text>
          <Button
            label="Khám phá nhà hàng ngay"
            style={styles.exploreBtn}
            onPress={onExploreFood}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Giỏ hàng của bạn"
        subtitle={`${items.reduce((s, i) => s + i.quantity, 0)} món ăn`}
        rightAction={
          <Pressable hitSlop={10} onPress={handleClear}>
            <Text style={styles.clearText}>Xóa hết</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.itemsCard}>
          {items.map((line, idx) => (
            <View
              key={line.lineKey}
              style={[
                styles.itemRow,
                idx !== items.length - 1 && styles.itemRowBorder,
              ]}
            >
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{line.name}</Text>
                {line.selectedOptions && line.selectedOptions.length > 0 ? (
                  <View style={styles.optionsWrap}>
                    {line.selectedOptions.map((opt) => (
                      <Text
                        key={`${opt.groupName}-${opt.optionName}`}
                        style={styles.optionText}
                      >
                        • {opt.groupName}: {opt.optionName}
                        {opt.priceDelta ? ` (+${formatVnd(opt.priceDelta)})` : ""}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.itemPrice}>
                  {formatVnd(line.unitPrice * line.quantity)}
                </Text>
              </View>

              <View style={styles.quantityControls}>
                <Pressable
                  style={styles.qtyBtn}
                  accessibilityRole="button"
                  accessibilityLabel={line.quantity === 1 ? `Xóa ${line.name}` : `Giảm số lượng ${line.name}`}
                  onPress={() => onUpdateQuantity(line, line.quantity - 1)}
                >
                  {line.quantity === 1 ? <Icon name="trash" size={16} color={colors.textPrimary} /> : <Text style={styles.qtyBtnText}>−</Text>}
                </Pressable>
                <Text style={styles.qtyText}>{line.quantity}</Text>
                <Pressable
                  style={styles.qtyBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Tăng số lượng ${line.name}`}
                  onPress={() => onUpdateQuantity(line, line.quantity + 1)}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {/* Price Breakdown Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Tóm tắt hóa đơn</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tạm tính</Text>
            <Text style={styles.summaryValue}>{formatVnd(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phí giao hàng ước tính</Text>
            <Text style={styles.summaryValue}>Tính ở bước kế tiếp</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>{formatVnd(subtotal)}</Text>
          </View>
        </View>

        <Button
          label={`Tiến hành thanh toán • ${formatVnd(subtotal)}`}
          loading={loading}
          onPress={onProceedCheckout}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 110,
  },
  clearText: {
    ...typography.captionBold,
    color: colors.accent,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    ...typography.title1,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  exploreBtn: {
    marginTop: spacing.md,
  },
  itemsCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  itemInfo: {
    flex: 1,
    gap: 3,
    paddingRight: spacing.sm,
  },
  itemName: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  optionsWrap: {
    gap: 2,
    marginVertical: 2,
  },
  optionText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  itemPrice: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: "700",
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 18,
  },
  qtyText: {
    ...typography.subhead,
    minWidth: 18,
    textAlign: "center",
  },
  summaryCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.bodySecondary,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  totalLabel: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  totalValue: {
    ...typography.title1,
    color: colors.primary,
    fontWeight: "700",
  },
});
