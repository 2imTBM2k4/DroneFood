import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/common/Button";
import { GlassSurface } from "../../components/common/GlassSurface";
import { Header } from "../../components/common/Header";
import { Icon } from "../../components/common/Icon";
import { resolveMediaUrl } from "../../api/client";
import { getCartCardMeta } from "../../cart/cartState";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import type { CartSummary } from "../../types";

interface CartIndexScreenProps {
  carts: CartSummary[];
  loading: boolean;
  onOpenCart: (cartId: string) => void;
  onExploreFood: () => void;
}

export const CartIndexScreen: React.FC<CartIndexScreenProps> = ({ carts, loading, onOpenCart, onExploreFood }) => (
  <View style={styles.screen}>
    <Header title="Giỏ hàng" subtitle={carts.length ? `${carts.length} nhà hàng` : undefined} />
    {!loading && carts.length === 0 ? (
      <View style={styles.emptyWrap}>
        <GlassSurface tone="strong" contentStyle={styles.emptyCard}>
          <View style={styles.emptyIcon}><Icon name="cart" size={34} color={colors.primary} /></View>
          <Text style={styles.emptyTitle}>Giỏ hàng đang trống</Text>
          <Text style={styles.emptyText}>Món từ mỗi nhà hàng sẽ được lưu trong một giỏ riêng.</Text>
          <Button label="Khám phá nhà hàng" onPress={onExploreFood} style={styles.emptyButton} />
        </GlassSurface>
      </View>
    ) : (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {carts.map((cart) => (
          <Pressable
            key={cart.cartId}
            accessibilityRole="button"
            accessibilityLabel={`Mở giỏ hàng ${cart.restaurant.name}`}
            onPress={() => onOpenCart(cart.cartId)}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <GlassSurface tone="strong" contentStyle={[styles.cartCard, cart.restaurant.isOpen === false && styles.cartCardClosed]}>
              {cart.restaurant.image ? (
                <Image
                  source={{ uri: resolveMediaUrl(cart.restaurant.image) }}
                  style={styles.restaurantAvatar}
                  resizeMode="cover"
                  accessibilityLabel={`Ảnh cửa hàng ${cart.restaurant.name}`}
                />
              ) : (
                <View style={styles.restaurantAvatarFallback}>
                  <Icon name="store" size={25} color={colors.primary} />
                </View>
              )}
              <View style={styles.cartCopy}>
                <Text numberOfLines={1} style={styles.restaurantName}>{cart.restaurant.name}</Text>
                <Text style={[styles.meta, cart.restaurant.isOpen === false && styles.closedText]}>{getCartCardMeta(cart).join(" · ")}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textSecondary} />
            </GlassSurface>
          </Pressable>
        ))}
      </ScrollView>
    )}
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: spacing.md, paddingBottom: 132, gap: spacing.sm },
  cartCard: { minHeight: 96, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md },
  cartCardClosed: { borderColor: colors.danger },
  restaurantAvatar: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.surfaceSubtle },
  restaurantAvatarFallback: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  cartCopy: { flex: 1, gap: spacing.xxs },
  restaurantName: { ...typography.subheadBold, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
  closedText: { color: colors.danger },
  pressed: { opacity: motion.pressedOpacity, transform: [{ scale: motion.pressedScale }] },
  emptyWrap: { flex: 1, padding: spacing.md, justifyContent: "center" },
  emptyCard: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  emptyIcon: { width: 68, height: 68, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  emptyTitle: { ...typography.title1, color: colors.textPrimary, textAlign: "center" },
  emptyText: { ...typography.bodySecondary, color: colors.textSecondary, textAlign: "center", maxWidth: 280 },
  emptyButton: { marginTop: spacing.sm, alignSelf: "stretch" },
});
