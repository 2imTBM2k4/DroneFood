import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatDistance } from "../../api/client";
import { Button } from "../../components/common/Button";
import { FilterChip } from "../../components/common/FilterChip";
import { Icon, type IconName } from "../../components/common/Icon";
import { Input } from "../../components/common/Input";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import type { Restaurant, UserProfile } from "../../types";
import { clampExploreHeaderProgress, exploreHeaderMetrics } from "./exploreHeaderState";

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Restaurant>);

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
  { id: "rice", name: "Cơm tấm", icon: "utensils" },
  { id: "pizza", name: "Pizza Ý", icon: "pizza" },
  { id: "noodles", name: "Phở & Bún", icon: "utensils" },
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
  const scrollY = useRef(new Animated.Value(0)).current;
  const [headerProgress, setHeaderProgress] = useState(0);
  const headerMetrics = exploreHeaderMetrics(headerProgress, compact);

  const filtered = useMemo(() => restaurants.filter((restaurant) => {
    const haystack = `${restaurant.name} ${restaurant.address} ${restaurant.description || ""}`.toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    const matchesCategory = category === "all" || (KEYWORDS[category] || []).some((word) => haystack.includes(word));
    return matchesQuery && matchesCategory;
  }), [restaurants, query, category]);

  const displayName = userProfile?.name ? userProfile.name.split(" ")[0] : "Bạn";
  const addressText = currentAddressText.trim()
    || userProfile?.address?.address
    || (hasLocation ? "Vị trí GPS hiện tại" : "Chọn địa chỉ giao");

  return (
    <View style={styles.screen}>
      {/* Sticky Header with Hi [Name] + Location Pill & Search Bar */}
      <View style={styles.stickyHeader}>
        <View style={[styles.stickyContent, { backgroundColor: headerMetrics.backgroundColor, paddingVertical: headerMetrics.verticalPadding }]}>
          {/* Header Row: Hi [Name] 👋 (Left) + Location Pill (Right) */}
          <View style={styles.headerTopRow}>
            <View style={styles.greetingWrap}>
              <Text style={styles.greetingSub}>Chào bạn đến DroneFood,</Text>
              <Text style={styles.greetingTitle} numberOfLines={1}>
                Hi, {displayName} 👋
              </Text>
            </View>

            {/* Location Pill Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Địa chỉ giao hàng: ${addressText}`}
              onPress={onOpenAddressBook}
              style={({ pressed }) => [styles.locationPill, pressed && styles.pressed]}
            >
              <Icon name="map-pin" size={14} color={colors.primary} />
              <Text numberOfLines={1} style={styles.locationPillText}>
                {addressText}
              </Text>
              <Icon name="chevron-down" size={13} color={colors.primary} />
            </Pressable>
          </View>

          {/* Search Input Bar (Pill Shape with soft sky blue #EAF2FC background) */}
          <Input
            containerStyle={styles.searchContainer}
            inputWrapperStyle={[styles.searchInputWrapper, { minHeight: headerMetrics.controlMinHeight }]}
            placeholder="Tìm món ngon, nhà hàng hoặc ưu đãi..."
            value={query}
            onChangeText={setQuery}
            leftIcon={<Icon name="search" size={18} color={colors.primary} />}
            rightIcon={
              query ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" hitSlop={12} onPress={() => setQuery("")}>
                  <Icon name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : undefined
            }
          />
        </View>
      </View>

      <AnimatedFlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        onRefresh={onRefresh}
        refreshing={loading}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.list, compact && styles.listCompact, { paddingTop: compact ? 132 : 140 }]}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false,
            listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              setHeaderProgress(clampExploreHeaderProgress(event.nativeEvent.contentOffset.y));
            },
          }
        )}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            {/* Hero Banner with Dark Scrim & Dual Pill Buttons (Explore Now + Editor's Pick) */}
            <View style={[styles.heroBanner, compact && styles.heroBannerCompact]}>
              {/* Dark Gradient Scrim to ensure WCAG >= 4.5:1 text contrast */}
              <LinearGradient
                colors={["rgba(10, 30, 60, 0.55)", "rgba(5, 18, 38, 0.92)"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.bannerBody}>
                <View style={styles.bannerBadge}>
                  <Text style={styles.bannerBadgeText}>ƯU ĐÃI ĐỘC QUYỀN</Text>
                </View>
                <Text style={[styles.bannerTitle, compact && styles.bannerTitleCompact]}>
                  DroneFood Express{"\n"}Giao siêu tốc 15 phút
                </Text>
                <Text style={styles.bannerSubtitle}>
                  Freeship 0đ mọi đơn hàng trải nghiệm giao đồ ăn bằng drone đầu tiên tại Việt Nam.
                </Text>

                {/* Dual Action Buttons */}
                <View style={styles.bannerActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Khám phá ngay thực đơn"
                    onPress={() => {}}
                    style={({ pressed }) => [styles.bannerPrimaryPill, pressed && styles.pressed]}
                  >
                    <Text style={styles.bannerPrimaryPillText}>Khám phá ngay</Text>
                  </Pressable>

                  <Button
                    label="Editor's Pick"
                    variant="glass"
                    size="sm"
                    onPress={() => {}}
                  />
                </View>
              </View>

              <View style={[styles.bannerDroneIcon, compact && styles.bannerDroneIconCompact]}>
                <Icon name="drone" size={compact ? 44 : 56} color="rgba(255, 255, 255, 0.9)" />
              </View>
            </View>

            {/* Horizontal Categories - Rounded Square Cards (80x80) with Centered Icon & Label Below */}
            <View style={styles.categorySection}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionHeading}>Danh mục món ngon</Text>
                <Text style={styles.sectionHeadingSub}>Khám phá theo sở thích</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {CATEGORIES.map((item) => {
                  const isSelected = item.id === category;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Danh mục ${item.name}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setCategory(item.id)}
                      style={({ pressed }) => [styles.categoryItem, pressed && styles.pressed]}
                    >
                      <View
                        style={[
                          styles.categorySquare,
                          isSelected && styles.categorySquareSelected,
                        ]}
                      >
                        <Icon
                          name={item.icon}
                          size={28}
                          color={isSelected ? colors.textWhite : colors.primary}
                          variant={isSelected ? "solid" : "outline"}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryLabel,
                          isSelected && styles.categoryLabelSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Promo Highlights Cards */}
            <View style={styles.promoHighlightSection}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionHeading}>Nổi bật tuần này</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.promoScroll}
              >
                <View style={[styles.highlightCard, { backgroundColor: "#0055AA" }]}>
                  <View style={styles.highlightContent}>
                    <Text style={styles.highlightBadge}>TRENDING NOW 🔥</Text>
                    <Text style={styles.highlightTitle}>Bữa Trưa Siêu Tốc</Text>
                    <Text style={styles.highlightText}>Combo cơm sườn & bún bò giảm ngay 30%</Text>
                  </View>
                  <Icon name="drone" size={38} color="rgba(255, 255, 255, 0.4)" />
                </View>

                <View style={[styles.highlightCard, { backgroundColor: "#1A4476" }]}>
                  <View style={styles.highlightContent}>
                    <Text style={styles.highlightBadge}>DRONE VOUCHER</Text>
                    <Text style={styles.highlightTitle}>Trà Sữa Giờ Vàng</Text>
                    <Text style={styles.highlightText}>Mua 1 tặng 1 từ 14:00 đến 17:00</Text>
                  </View>
                  <Icon name="coffee" size={38} color="rgba(255, 255, 255, 0.4)" />
                </View>
              </ScrollView>
            </View>

            {/* Restaurant List Section Header */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Quán ngon gần bạn</Text>
                <Text style={styles.sectionSubtitle}>Bán kính giao drone 15 km · Thời gian 15-20 phút</Text>
              </View>
              <Text style={styles.resultCount}>{filtered.length} quán</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Icon
                name={loading ? "refresh" : hasLocation ? "search" : "crosshair"}
                size={34}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {loading ? "Đang tìm nhà hàng..." : hasLocation ? "Chưa tìm thấy quán phù hợp" : "Cần vị trí của bạn"}
            </Text>
            <Text style={styles.emptyText}>
              {hasLocation
                ? "Thử đổi từ khóa hoặc chọn lại danh mục món ăn."
                : "Bật GPS hoặc chọn một địa chỉ đã lưu để xem nhà hàng gần nhất."}
            </Text>
            {!hasLocation ? (
              <Button
                label={locating ? "Đang định vị..." : "Dùng vị trí hiện tại"}
                variant="primary"
                onPress={onLocateGps}
                disabled={locating}
                style={styles.emptyAction}
              />
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mở nhà hàng ${item.name}`}
            onPress={() => onSelectRestaurant(item)}
            style={({ pressed }) => [styles.restaurantCard, pressed && styles.cardPressed]}
          >
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={[styles.restaurantImage, compact && styles.restaurantImageCompact]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.imageFallback, compact && styles.restaurantImageCompact]}>
                <Icon name="store" size={compact ? 28 : 34} color={colors.primary} />
              </View>
            )}
            <View style={styles.restaurantBody}>
              <View style={styles.restaurantTop}>
                <Text numberOfLines={2} style={styles.restaurantName}>
                  {item.name}
                </Text>
                <View style={[styles.openDot, item.isOpen === false && styles.closedDot]} />
              </View>
              <Text numberOfLines={1} style={styles.restaurantDescription}>
                {item.description || item.address}
              </Text>
              <View style={styles.restaurantMeta}>
                <View style={styles.metaItem}>
                  <Icon name="star" size={14} color="#FBBF24" variant="solid" />
                  <Text style={styles.metaText}>
                    {item.averageRating?.toFixed(1) || item.rating?.toFixed(1) || "4.8"}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Icon name="clock" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>15–20 phút</Text>
                </View>
                {item.distanceKm != null ? (
                  <View style={styles.metaItem}>
                    <Icon name="drone" size={14} color={colors.primary} />
                    <Text style={styles.metaTextPrimary}>{formatDistance(item.distanceKm)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 80,
  },
  stickyContent: {
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.xs,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  greetingWrap: {
    flex: 1,
    gap: 1,
  },
  greetingSub: {
    ...typography.micro,
    color: colors.textSecondary,
    fontSize: 11,
  },
  greetingTitle: {
    ...typography.screenTitle,
    fontSize: 19,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    maxWidth: "50%",
    borderWidth: 1,
    borderColor: "rgba(0, 102, 204, 0.12)",
  },
  locationPillText: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: "600",
    fontSize: 12,
    flexShrink: 1,
  },
  searchContainer: {
    marginTop: 2,
  },
  searchInputWrapper: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
  },
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
  disabled: {
    opacity: 0.5,
  },
  list: {
    padding: spacing.screenPadding,
    paddingBottom: 132,
    gap: spacing.md,
  },
  listCompact: {
    paddingHorizontal: spacing.sm,
  },
  headerContent: {
    gap: spacing.lg,
  },
  heroBanner: {
    minHeight: 180,
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: "#0A1F3B",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  heroBannerCompact: {
    minHeight: 160,
    padding: spacing.md,
  },
  bannerBody: {
    flex: 1,
    gap: 6,
    zIndex: 2,
  },
  bannerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  bannerBadgeText: {
    ...typography.micro,
    color: colors.textWhite,
    letterSpacing: 0.8,
    fontWeight: "700",
    fontSize: 10,
  },
  bannerTitle: {
    ...typography.hero,
    color: colors.textWhite,
    fontSize: 21,
    lineHeight: 26,
  },
  bannerTitleCompact: {
    fontSize: 18,
    lineHeight: 22,
  },
  bannerSubtitle: {
    ...typography.caption,
    color: "rgba(255, 255, 255, 0.82)",
    maxWidth: 240,
    fontSize: 12,
    lineHeight: 16,
  },
  bannerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  bannerPrimaryPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerPrimaryPillText: {
    ...typography.caption,
    color: "#0A1F3B",
    fontWeight: "700",
    fontSize: 12,
  },
  bannerGlassPill: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  bannerGlassPillText: {
    ...typography.caption,
    color: colors.textWhite,
    fontWeight: "600",
    fontSize: 12,
  },
  bannerDroneIcon: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    zIndex: 2,
  },
  bannerDroneIconCompact: {
    width: 54,
    height: 54,
  },
  categorySection: {
    gap: spacing.sm,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionHeading: {
    ...typography.sectionTitle,
    fontSize: 17,
    color: colors.textPrimary,
  },
  sectionHeadingSub: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  categoryScroll: {
    gap: spacing.md,
    paddingRight: spacing.screenPadding,
  },
  categoryItem: {
    alignItems: "center",
    gap: 6,
    width: 72,
  },
  categorySquare: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#003366",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  categorySquareSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "500",
    fontSize: 12,
    textAlign: "center",
  },
  categoryLabelSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  promoHighlightSection: {
    gap: spacing.sm,
  },
  promoScroll: {
    gap: spacing.md,
    paddingRight: spacing.screenPadding,
  },
  highlightCard: {
    width: 260,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  highlightContent: {
    flex: 1,
    gap: 3,
  },
  highlightBadge: {
    ...typography.micro,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  highlightTitle: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textWhite,
    fontSize: 15,
  },
  highlightText: {
    ...typography.micro,
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 11,
    lineHeight: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    fontSize: 18,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  resultCount: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  emptyTitle: {
    ...typography.screenTitle,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptyText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 290,
  },
  emptyAction: {
    marginTop: spacing.xs,
  },
  restaurantCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    shadowColor: "#003366",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardPressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
  restaurantImage: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  restaurantImageCompact: {
    width: 80,
    height: 80,
  },
  imageFallback: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantBody: {
    flex: 1,
    justifyContent: "space-between",
    gap: 4,
  },
  restaurantTop: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "flex-start",
  },
  restaurantName: {
    ...typography.foodTitle,
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  openDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginTop: 6,
  },
  closedDot: {
    backgroundColor: colors.danger,
  },
  restaurantDescription: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  restaurantMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  metaTextPrimary: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },
});
