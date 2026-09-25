import React, { useMemo, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { formatDistance } from "../../api/client";
import { GlassSurface } from "../../components/common/GlassSurface";
import { Icon, type IconName } from "../../components/common/Icon";
import { Input } from "../../components/common/Input";
import { colors, radius, shadows, spacing, typography } from "../../theme/tokens";
import type { Restaurant, UserProfile } from "../../types";

interface HomeScreenProps {
  restaurants: Restaurant[];
  loading: boolean;
  onRefresh: () => void;
  onSelectRestaurant: (restaurant: Restaurant) => void;
  userProfile?: UserProfile | null;
  onLocateGps: () => void;
  locating?: boolean;
  hasLocation?: boolean;
  currentAddressText?: string;
  onOpenAddressBook?: () => void;
}

const CATEGORIES: { id: string; name: string; icon: IconName }[] = [
  { id: "all", name: "Tất cả", icon: "sparkles" },
  { id: "milktea", name: "Trà sữa", icon: "coffee" },
  { id: "rice", name: "Cơm", icon: "utensils" },
  { id: "pizza", name: "Pizza", icon: "pizza" },
  { id: "noodles", name: "Mì / Phở", icon: "utensils" },
  { id: "dessert", name: "Tráng miệng", icon: "cake" },
  { id: "healthy", name: "Healthy", icon: "leaf" },
];

const KEYWORDS: Record<string, string[]> = {
  milktea: ["trà sữa", "milk tea", "boba", "trà", "coffee", "cà phê"],
  rice: ["cơm", "rice", "sườn", "tấm"],
  pizza: ["pizza", "pasta", "ý"],
  noodles: ["mì", "phở", "bún", "hủ tiếu", "miến", "ramen"],
  dessert: ["chè", "bánh", "kem", "tráng miệng", "dessert"],
  healthy: ["salad", "healthy", "chay", "rau", "nước ép", "juice"],
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  restaurants,
  loading,
  onRefresh,
  onSelectRestaurant,
  userProfile,
  onLocateGps,
  locating = false,
  hasLocation = false,
  currentAddressText = "",
  onOpenAddressBook,
}) => {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => restaurants.filter((restaurant) => {
    const haystack = `${restaurant.name} ${restaurant.address} ${restaurant.description || ""}`.toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    const matchesCategory = category === "all" || (KEYWORDS[category] || []).some((word) => haystack.includes(word));
    return matchesQuery && matchesCategory;
  }), [restaurants, query, category]);

  const addressText = currentAddressText.trim()
    || userProfile?.address?.address
    || (hasLocation ? "Vị trí GPS hiện tại" : "Chọn địa chỉ để xem quán gần bạn");

  return (
    <View style={styles.screen}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        onRefresh={onRefresh}
        refreshing={loading}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.list, compact && styles.listCompact]}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <GlassSurface style={styles.locationCard} contentStyle={[styles.locationContent, compact && styles.locationContentCompact]} tone="strong">
              <Pressable style={styles.locationMain} onPress={onOpenAddressBook} disabled={!onOpenAddressBook}>
                <View style={styles.eyebrowRow}>
                  <Icon name="map-pin" size={14} color={colors.primary} />
                  <Text style={styles.eyebrow}>GIAO ĐẾN</Text>
                </View>
                <View style={styles.addressRow}>
                  <Text numberOfLines={1} style={[styles.address, compact && styles.addressCompact]}>{addressText}</Text>
                  {onOpenAddressBook ? <Icon name="chevron-right" size={15} color={colors.textSecondary} /> : null}
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={locating ? "Đang cập nhật vị trí" : "Cập nhật vị trí GPS"}
                disabled={locating}
                onPress={onLocateGps}
                style={({ pressed }) => [styles.locationButton, compact && styles.locationButtonCompact, pressed && styles.pressed, locating && styles.disabled]}
              >
                <Icon name={locating ? "refresh" : "crosshair"} size={compact ? 17 : 19} color={colors.primary} />
              </Pressable>
            </GlassSurface>

            <Input
              placeholder="Tìm món hoặc nhà hàng"
              value={query}
              onChangeText={setQuery}
              leftIcon={<Icon name="search" size={19} color={colors.textSecondary} />}
              rightIcon={query ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" hitSlop={10} onPress={() => setQuery("")}>
                  <Icon name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : undefined}
            />

            <View style={[styles.promoCard, compact && styles.promoCardCompact]}>
              <View style={styles.promoCopy}>
                <Text style={styles.promoEyebrow}>DRONEFOOD MEMBER</Text>
                <Text style={[styles.promoTitle, compact && styles.promoTitleCompact]}>Giao nhanh hơn.{"\n"}Ăn ngon hơn.</Text>
                <Text style={styles.promoText}>Ưu đãi được áp dụng tại bước thanh toán.</Text>
              </View>
              <View style={[styles.promoIcon, compact && styles.promoIconCompact]}>
                <Icon name="drone" size={compact ? 32 : 42} color={colors.textWhite} />
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
              {CATEGORIES.map((item) => {
                const selected = item.id === category;
                return (
                  <Pressable key={item.id} onPress={() => setCategory(item.id)} style={[styles.category, selected && styles.categorySelected]}>
                    <Icon name={item.icon} size={17} color={selected ? colors.textWhite : colors.textSecondary} />
                    <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>{item.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Gần bạn</Text>
                <Text style={styles.sectionSubtitle}>Trong bán kính giao hàng 15 km</Text>
              </View>
              <Text style={styles.resultCount}>{filtered.length} quán</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <GlassSurface style={styles.empty} contentStyle={styles.emptyContent} tone="soft">
            <View style={styles.emptyIcon}>
              <Icon name={loading ? "refresh" : hasLocation ? "search" : "crosshair"} size={34} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{loading ? "Đang tìm nhà hàng..." : hasLocation ? "Chưa tìm thấy quán phù hợp" : "Cần vị trí của bạn"}</Text>
            <Text style={styles.emptyText}>{hasLocation ? "Thử đổi từ khóa hoặc chọn lại danh mục." : "Bật GPS hoặc chọn một địa chỉ đã lưu để xem nhà hàng gần nhất."}</Text>
            {!hasLocation ? <Pressable style={styles.emptyAction} onPress={onLocateGps} disabled={locating}><Text style={styles.emptyActionText}>{locating ? "Đang định vị..." : "Dùng vị trí hiện tại"}</Text></Pressable> : null}
          </GlassSurface>
        )}
        renderItem={({ item }) => (
          <Pressable onPress={() => onSelectRestaurant(item)} style={({ pressed }) => pressed && styles.cardPressed}>
            <GlassSurface style={styles.restaurantCard} contentStyle={[styles.restaurantContent, compact && styles.restaurantContentCompact]} tone="strong">
              {item.image ? <Image source={{ uri: item.image }} style={[styles.restaurantImage, compact && styles.restaurantImageCompact]} resizeMode="cover" /> : <View style={[styles.imageFallback, compact && styles.restaurantImageCompact]}><Icon name="store" size={compact ? 28 : 34} color={colors.textSecondary} /></View>}
              <View style={styles.restaurantBody}>
                <View style={styles.restaurantTop}><Text numberOfLines={2} style={styles.restaurantName}>{item.name}</Text><View style={[styles.openDot, item.isOpen === false && styles.closedDot]} /></View>
                <Text numberOfLines={1} style={styles.restaurantDescription}>{item.description || item.address}</Text>
                <View style={styles.restaurantMeta}>
                  <View style={styles.metaItem}><Icon name="star" size={14} color={colors.primary} /><Text style={styles.metaText}>{item.averageRating?.toFixed(1) || item.rating?.toFixed(1) || "Mới"}</Text></View>
                  <View style={styles.metaItem}><Icon name="clock" size={14} color={colors.textSecondary} /><Text style={styles.metaText}>15–20 phút</Text></View>
                </View>
                <View style={styles.cardBottom}>
                  {item.distanceKm != null ? <Text style={styles.distance}>{formatDistance(item.distanceKm)}</Text> : null}
                </View>
              </View>
            </GlassSurface>
          </Pressable>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  locationCard: { width: "100%" },
  locationContent: { minHeight: 72, paddingLeft: spacing.md, paddingRight: spacing.xs, paddingVertical: spacing.xs, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  locationContentCompact: { minHeight: 64, paddingLeft: spacing.sm },
  locationMain: { flex: 1, justifyContent: "center" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  eyebrow: { ...typography.micro, color: colors.primary, letterSpacing: 1 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: spacing.xxs, marginTop: 3 },
  address: { ...typography.subhead, color: colors.textPrimary, flex: 1 },
  addressCompact: { fontSize: 14, lineHeight: 18 },
  locationButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.border },
  locationButtonCompact: { width: 44, height: 44, borderRadius: 22 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
  list: { padding: spacing.md, paddingBottom: 132, gap: spacing.md },
  listCompact: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  headerContent: { gap: spacing.md },
  promoCard: { minHeight: 154, borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.primary, overflow: "hidden", flexDirection: "row", alignItems: "center", ...shadows.floating },
  promoCardCompact: { minHeight: 140, padding: spacing.md },
  promoCopy: { flex: 1, gap: 5 },
  promoEyebrow: { ...typography.micro, color: "rgba(255,255,255,0.78)", letterSpacing: 1 },
  promoTitle: { ...typography.hero, color: colors.textWhite, fontSize: 27, lineHeight: 31 },
  promoTitleCompact: { fontSize: 23, lineHeight: 27 },
  promoText: { ...typography.caption, color: "rgba(255,255,255,0.82)", maxWidth: 210 },
  promoIcon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" },
  promoIconCompact: { width: 60, height: 60, borderRadius: 30 },
  categories: { gap: spacing.xs, paddingRight: spacing.md },
  category: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.glassFillStrong, borderWidth: 1, borderColor: colors.glassBorder },
  categorySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryLabel: { ...typography.captionBold, color: colors.textSecondary },
  categoryLabelSelected: { color: colors.textWhite },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.xs },
  sectionTitle: { ...typography.title1, color: colors.textPrimary },
  sectionSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  resultCount: { ...typography.captionBold, color: colors.primary },
  empty: { marginTop: spacing.md },
  emptyContent: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight },
  emptyTitle: { ...typography.title2, color: colors.textPrimary, textAlign: "center" },
  emptyText: { ...typography.bodySecondary, color: colors.textSecondary, textAlign: "center", maxWidth: 290 },
  emptyAction: { minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.primary, justifyContent: "center", marginTop: spacing.xs },
  emptyActionText: { ...typography.subhead, color: colors.textWhite },
  restaurantCard: { marginBottom: 0 },
  restaurantContent: { minHeight: 132, padding: spacing.xs, flexDirection: "row", gap: spacing.md },
  restaurantContentCompact: { minHeight: 112, gap: spacing.sm },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
  restaurantImage: { width: 122, minHeight: 116, borderRadius: radius.lg, backgroundColor: colors.surfaceSubtle },
  restaurantImageCompact: { width: 94, minHeight: 96, borderRadius: radius.md },
  imageFallback: { width: 122, minHeight: 116, borderRadius: radius.lg, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  restaurantBody: { flex: 1, paddingVertical: spacing.xxs, paddingRight: spacing.xxs, justifyContent: "space-between" },
  restaurantTop: { flexDirection: "row", gap: spacing.xs, alignItems: "flex-start" },
  restaurantName: { ...typography.subheadBold, color: colors.textPrimary, flex: 1, lineHeight: 20 },
  openDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginTop: 5 },
  closedDot: { backgroundColor: colors.danger },
  restaurantDescription: { ...typography.caption, color: colors.textSecondary },
  restaurantMeta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { ...typography.captionBold, color: colors.textPrimary },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xs },
  distance: { ...typography.caption, color: colors.textSecondary },
});
