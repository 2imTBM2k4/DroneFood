import React from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { formatVnd, resolveMediaUrl } from "../../api/client";
import { Button } from "../../components/common/Button";
import { GlassSurface } from "../../components/common/GlassSurface";
import { Header } from "../../components/common/Header";
import { Icon } from "../../components/common/Icon";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { Cart, CartLine } from "../../types";

interface CartScreenProps {
  cart?: Cart;
  loading: boolean;
  onUpdateQuantity: (line: CartLine, quantity: number) => Promise<void>;
  onClearCart: () => Promise<void>;
  onProceedCheckout: () => void;
  onExploreFood: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({ cart, loading, onUpdateQuantity, onClearCart, onProceedCheckout, onExploreFood }) => {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const items = cart?.items || [];
  const subtotal = cart?.subtotal || 0;
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  const confirmClear = () => Alert.alert("Xóa giỏ hàng", "Bạn muốn xóa toàn bộ món trong giỏ?", [
    { text: "Giữ lại", style: "cancel" },
    { text: "Xóa hết", style: "destructive", onPress: onClearCart },
  ]);

  if (!items.length) return (
    <View style={styles.screen}>
      <Header title="Giỏ hàng" />
      <View style={styles.emptyWrap}>
        <GlassSurface tone="strong" contentStyle={styles.emptyCard}>
          <View style={styles.emptyIcon}><Icon name="cart" size={34} color={colors.primary} /></View>
          <Text style={styles.emptyTitle}>Giỏ hàng đang trống</Text>
          <Text style={styles.emptyText}>Chọn món từ nhà hàng gần bạn để bắt đầu đơn hàng.</Text>
          <Button label="Khám phá nhà hàng" onPress={onExploreFood} style={styles.emptyButton} />
        </GlassSurface>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Header title="Giỏ hàng" subtitle={`${count} món`} rightAction={<Pressable hitSlop={10} onPress={confirmClear}><Text style={styles.clear}>Xóa hết</Text></Pressable>} />
      <ScrollView contentContainerStyle={[styles.content, compact && styles.contentCompact]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <GlassSurface tone="strong" contentStyle={[styles.itemsCard, compact && styles.itemsCardCompact]}>
          {items.map((line, index) => (
            <View key={line.lineKey} style={[styles.item, index < items.length - 1 && styles.itemBorder]}>
              {line.image ? (
                <Image source={{ uri: resolveMediaUrl(line.image) }} style={[styles.itemImage, compact && styles.itemImageCompact]} resizeMode="cover" accessibilityLabel={`Hình món ${line.name}`} />
              ) : (
                <View style={[styles.itemImageFallback, compact && styles.itemImageCompact]}><Icon name="utensils" size={compact ? 23 : 27} color={colors.textSecondary} /></View>
              )}
              <View style={styles.itemInfo}>
                <Text numberOfLines={2} style={styles.itemName}>{line.name}</Text>
                {line.selectedOptions?.map((option) => <Text numberOfLines={1} key={`${option.groupName}-${option.optionName}`} style={styles.option}>{option.groupName}: {option.optionName}{option.priceDelta ? ` · +${formatVnd(option.priceDelta)}` : ""}</Text>)}
                <View style={styles.itemFooter}>
                  <Text style={styles.itemPrice}>{formatVnd(line.unitPrice * line.quantity)}</Text>
                  <View style={styles.quantity}>
                    <Pressable style={styles.qtyButton} accessibilityRole="button" accessibilityLabel={line.quantity === 1 ? `Xóa ${line.name}` : `Giảm ${line.name}`} onPress={() => onUpdateQuantity(line, line.quantity - 1)}>
                      {line.quantity === 1 ? <Icon name="trash" size={15} color={colors.textSecondary} /> : <Text style={styles.qtyButtonText}>−</Text>}
                    </Pressable>
                    <Text style={styles.qty}>{line.quantity}</Text>
                    <Pressable style={[styles.qtyButton, styles.qtyAdd]} accessibilityRole="button" accessibilityLabel={`Tăng ${line.name}`} onPress={() => onUpdateQuantity(line, line.quantity + 1)}><Text style={[styles.qtyButtonText, styles.qtyAddText]}>+</Text></Pressable>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </GlassSurface>

        <GlassSurface tone="soft" contentStyle={styles.noteCard}>
          <Icon name="sparkles" size={18} color={colors.primary} />
          <Text style={styles.noteText}>Phí giao hàng được tính theo địa chỉ và phương thức giao ở bước tiếp theo.</Text>
        </GlassSurface>

        <GlassSurface tone="strong" contentStyle={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Tóm tắt</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Tạm tính</Text><Text style={styles.summaryValue}>{formatVnd(subtotal)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Phí giao hàng</Text><Text style={styles.summaryMuted}>Tính khi thanh toán</Text></View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}><Text style={styles.totalLabel}>Tổng tạm tính</Text><Text style={styles.total}>{formatVnd(subtotal)}</Text></View>
        </GlassSurface>

        <Button label={`Tiếp tục thanh toán · ${formatVnd(subtotal)}`} loading={loading} onPress={onProceedCheckout} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: spacing.md, paddingBottom: 132, gap: spacing.md },
  contentCompact: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  clear: { ...typography.captionBold, color: colors.danger },
  emptyWrap: { flex: 1, padding: spacing.md, justifyContent: "center" },
  emptyCard: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  emptyTitle: { ...typography.title1, color: colors.textPrimary, textAlign: "center" },
  emptyText: { ...typography.bodySecondary, color: colors.textSecondary, textAlign: "center", maxWidth: 280 },
  emptyButton: { marginTop: spacing.sm, alignSelf: "stretch" },
  itemsCard: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  itemsCardCompact: { paddingHorizontal: spacing.sm },
  item: { minHeight: 120, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemImage: { width: 86, height: 86, borderRadius: radius.md, backgroundColor: colors.surfaceSubtle },
  itemImageCompact: { width: 70, height: 70, borderRadius: radius.sm },
  itemImageFallback: { width: 86, height: 86, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight },
  itemInfo: { flex: 1, gap: 3 },
  itemName: { ...typography.subheadBold, color: colors.textPrimary },
  option: { ...typography.caption, color: colors.textSecondary },
  itemPrice: { ...typography.captionBold, color: colors.primary, marginTop: 3 },
  itemFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs, marginTop: spacing.xxs },
  quantity: { flexDirection: "row", alignItems: "center", gap: 4, padding: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
  qtyButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  qtyAdd: { backgroundColor: colors.primary },
  qtyButtonText: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  qtyAddText: { color: colors.textWhite },
  qty: { ...typography.subheadBold, color: colors.textPrimary, minWidth: 22, textAlign: "center" },
  noteCard: { padding: spacing.md, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  noteText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  summaryCard: { padding: spacing.lg, gap: spacing.sm },
  summaryTitle: { ...typography.title2, color: colors.textPrimary, marginBottom: spacing.xxs },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  summaryLabel: { ...typography.bodySecondary, color: colors.textSecondary },
  summaryValue: { ...typography.body, color: colors.textPrimary, fontWeight: "700" },
  summaryMuted: { ...typography.caption, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  totalLabel: { ...typography.subheadBold, color: colors.textPrimary },
  total: { ...typography.title1, color: colors.primary },
});
