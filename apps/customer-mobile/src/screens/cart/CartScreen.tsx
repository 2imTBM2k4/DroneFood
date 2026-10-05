import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { formatVnd, resolveMediaUrl } from "../../api/client";
import { Button } from "../../components/common/Button";
import { Header } from "../../components/common/Header";
import { Icon } from "../../components/common/Icon";
import { InfoRow } from "../../components/common/InfoRow";
import { useToast } from "../../components/common/ToastProvider";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { Cart, CartLine } from "../../types";

interface CartScreenProps {
  cart?: Cart;
  loading: boolean;
  onUpdateQuantity: (line: CartLine, quantity: number) => Promise<void>;
  onClearCart: () => Promise<void>;
  onProceedCheckout: () => void;
  onExploreFood: () => void;
  onBack: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({
  cart,
  loading,
  onUpdateQuantity,
  onClearCart,
  onProceedCheckout,
  onExploreFood,
  onBack,
}) => {
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const items = cart?.items || [];
  const subtotal = cart?.subtotal || 0;
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const closed = cart?.restaurant?.isOpen === false;

  const confirmClear = () =>
    showToast({
      type: "warning",
      title: "Xóa giỏ hàng?",
      message: "Bạn muốn xóa toàn bộ món trong giỏ?",
      duration: 8000,
      secondaryAction: { label: "Giữ lại" },
      primaryAction: { label: "Xóa hết", destructive: true, onPress: onClearCart },
    });

  if (!items.length) {
    return (
      <View style={styles.screen}>
        <Header title="Chi tiết giỏ hàng" onBack={onBack} />
        <View style={styles.emptyWrap}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Icon name="cart" size={34} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Giỏ hàng đang trống</Text>
            <Text style={styles.emptyText}>
              Chọn món từ nhà hàng gần bạn để bắt đầu đơn hàng.
            </Text>
            <Button
              label="Khám phá nhà hàng"
              variant="primary"
              onPress={onExploreFood}
              style={styles.emptyButton}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header
        title="Chi tiết giỏ hàng"
        subtitle={`${count} món`}
        onBack={onBack}
        rightAction={
          <Pressable hitSlop={12} onPress={confirmClear}>
            <Text style={styles.clear}>Xóa hết</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Restaurant Header Card */}
        <View style={styles.restaurantCard}>
          {cart?.restaurant?.image ? (
            <Image
              source={{ uri: resolveMediaUrl(cart.restaurant.image) }}
              style={styles.restaurantAvatar}
              resizeMode="cover"
              accessibilityLabel={`Ảnh cửa hàng ${cart.restaurant.name}`}
            />
          ) : (
            <View style={styles.restaurantAvatarFallback}>
              <Icon name="store" size={27} color={colors.primary} />
            </View>
          )}
          <View style={styles.restaurantCopy}>
            <Text numberOfLines={2} style={styles.restaurantName}>
              {cart?.restaurant?.name || "Nhà hàng"}
            </Text>
            <Text style={[styles.restaurantStatus, closed && styles.restaurantStatusClosed]}>
              {closed ? "Quán đang đóng cửa" : "Đang nhận đơn"}
            </Text>
          </View>
        </View>

        {closed ? (
          <View style={styles.closedCard}>
            <Icon name="clock" size={18} color={colors.danger} />
            <Text style={styles.closedText}>
              Quán đang đóng cửa. Bạn vẫn có thể sửa hoặc xóa món nhưng chưa thể đặt hàng.
            </Text>
          </View>
        ) : null}

        {/* Order Items List Card */}
        <View style={[styles.itemsCard, compact && styles.itemsCardCompact]}>
          {items.map((line, index) => (
            <View
              key={line.lineKey}
              style={[styles.item, index < items.length - 1 && styles.itemBorder]}
            >
              {line.image ? (
                <Image
                  source={{ uri: resolveMediaUrl(line.image) }}
                  style={[styles.itemImage, compact && styles.itemImageCompact]}
                  resizeMode="cover"
                  accessibilityLabel={`Hình món ${line.name}`}
                />
              ) : (
                <View style={[styles.itemImageFallback, compact && styles.itemImageCompact]}>
                  <Icon name="utensils" size={compact ? 23 : 27} color={colors.primary} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text numberOfLines={2} style={styles.itemName}>
                  {line.name}
                </Text>
                {line.selectedOptions?.map((option) => (
                  <Text
                    numberOfLines={1}
                    key={`${option.groupName}-${option.optionName}`}
                    style={styles.option}
                  >
                    {option.groupName}: {option.optionName}
                    {option.priceDelta ? ` · +${formatVnd(option.priceDelta)}` : ""}
                  </Text>
                ))}
                <View style={styles.itemFooter}>
                  <Text style={styles.itemPrice}>
                    {formatVnd(line.unitPrice * line.quantity)}
                  </Text>
                  {/* Stepper with >= 44x44 touch targets */}
                  <View style={styles.quantity}>
                    <Pressable
                      style={styles.qtyButton}
                      accessibilityRole="button"
                      accessibilityLabel={line.quantity === 1 ? `Xóa ${line.name}` : `Giảm ${line.name}`}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      onPress={() => onUpdateQuantity(line, line.quantity - 1)}
                    >
                      {line.quantity === 1 ? (
                        <Icon name="trash" size={15} color={colors.textSecondary} />
                      ) : (
                        <Text style={styles.qtyButtonText}>−</Text>
                      )}
                    </Pressable>
                    <Text style={styles.qty}>{line.quantity}</Text>
                    <Pressable
                      style={[styles.qtyButton, styles.qtyAdd]}
                      accessibilityRole="button"
                      accessibilityLabel={`Tăng ${line.name}`}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      onPress={() => onUpdateQuantity(line, line.quantity + 1)}
                    >
                      <Text style={[styles.qtyButtonText, styles.qtyAddText]}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Note Card */}
        <View style={styles.noteCard}>
          <Icon name="sparkles" size={18} color={colors.primary} />
          <Text style={styles.noteText}>
            Phí giao hàng được tính theo địa chỉ và phương thức giao ở bước tiếp theo.
          </Text>
        </View>

        {/* Order Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Tóm tắt đơn hàng</Text>
          <InfoRow label="Tạm tính" value={formatVnd(subtotal)} />
          <InfoRow label="Phí giao hàng" value="Tính khi thanh toán" />
          <View style={styles.divider} />
          <InfoRow label="Tổng tạm tính" value={formatVnd(subtotal)} isTotal />
        </View>

        {/* Sticky Action Button */}
        <Button
          label={closed ? "Quán đang đóng cửa" : `Tiếp tục thanh toán · ${formatVnd(subtotal)}`}
          loading={loading}
          disabled={closed}
          variant="primary"
          size="lg"
          fullWidth
          onPress={onProceedCheckout}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 132,
    gap: spacing.md,
  },
  contentCompact: {
    paddingHorizontal: spacing.sm,
  },
  clear: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.danger,
  },
  restaurantCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    shadowColor: "#003366",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  restaurantAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
  },
  restaurantAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantCopy: {
    flex: 1,
    gap: 2,
  },
  restaurantName: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  restaurantStatus: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.success,
  },
  restaurantStatusClosed: {
    color: colors.danger,
  },
  closedCard: {
    backgroundColor: colors.statusCancelledBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  closedText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.danger,
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
    padding: spacing.screenPadding,
    justifyContent: "center",
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    ...typography.screenTitle,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptyText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
  },
  emptyButton: {
    marginTop: spacing.sm,
    alignSelf: "stretch",
  },
  itemsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    shadowColor: "#003366",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  itemsCardCompact: {
    paddingHorizontal: spacing.sm,
  },
  item: {
    minHeight: 110,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  itemImageCompact: {
    width: 68,
    height: 68,
  },
  itemImageFallback: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  itemInfo: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    ...typography.foodTitle,
    fontSize: 14,
    color: colors.textPrimary,
  },
  option: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  itemPrice: {
    ...typography.price,
    fontSize: 14,
    color: colors.primary,
    marginTop: 2,
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  quantity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  qtyButton: {
    width: 38,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyAdd: {
    backgroundColor: colors.primary,
  },
  qtyButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  qtyAddText: {
    color: colors.textWhite,
  },
  qty: {
    ...typography.price,
    fontSize: 14,
    color: colors.textPrimary,
    minWidth: 22,
    textAlign: "center",
  },
  noteCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  noteText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  summaryCard: {
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
  summaryTitle: {
    ...typography.sectionTitle,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.xxs,
  },
});
