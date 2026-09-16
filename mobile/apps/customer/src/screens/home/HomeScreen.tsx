import React, { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatDistance } from "../../api/client";
import { Badge } from "../../components/common/Badge";
import { Input } from "../../components/common/Input";
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

const CATEGORIES = [
  { id: "all", name: "Tất cả", icon: "✨" },
  { id: "milktea", name: "Trà sữa", icon: "🧋" },
  { id: "rice", name: "Cơm", icon: "🍚" },
  { id: "pizza", name: "Pizza", icon: "🍕" },
  { id: "burger", name: "Burger", icon: "🍔" },
  { id: "noodles", name: "Mì / Phở", icon: "🍜" },
  { id: "dessert", name: "Tráng miệng", icon: "🍰" },
  { id: "healthy", name: "Healthy", icon: "🥗" },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  milktea: ["trà sữa", "milk tea", "boba", "trà", "tea", "cà phê", "coffee"],
  rice: ["cơm", "rice", "sườn", "tấm"],
  pizza: ["pizza", "ý", "pasta"],
  burger: ["burger", "gà rán", "fast food", "khoai tây"],
  noodles: ["mì", "phở", "bún", "hủ tiếu", "miến", "ramen", "noodle"],
  dessert: ["chè", "bánh", "kem", "tráng miệng", "dessert", "sweet"],
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchCategory = true;
      if (selectedCategory !== "all") {
        const keywords = CATEGORY_KEYWORDS[selectedCategory] || [];
        const content = `${item.name} ${item.description || ""} ${item.address}`.toLowerCase();
        matchCategory = keywords.some((kw) => content.includes(kw));
      }

      return matchSearch && matchCategory;
    });
  }, [restaurants, searchQuery, selectedCategory]);

  const deliveryAddress =
    currentAddressText?.trim() ||
    userProfile?.address?.address ||
    (hasLocation ? "Vị trí GPS hiện tại của bạn" : "Chạm nút GPS để định vị khu vực của bạn");

  return (
    <View style={styles.container}>
      {/* Top Location Bar */}
      <View style={styles.locationBar}>
        <Pressable
          style={styles.locationLeft}
          onPress={onOpenAddressBook}
          disabled={!onOpenAddressBook}
        >
          <View style={styles.deliverLabelRow}>
            <Text style={styles.deliverLabel}>📍 GIAO ĐẾN</Text>
          </View>
          <View style={styles.addressLineRow}>
            <Text numberOfLines={1} style={styles.addressText}>
              {deliveryAddress}
            </Text>
            {onOpenAddressBook ? (
              <View style={styles.deliverChangeBtn}>
                <Text style={styles.deliverChangeText}>Đổi ▾</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>

      <FlatList
        data={filteredRestaurants}
        keyExtractor={(item) => item._id}
        onRefresh={onRefresh}
        refreshing={loading}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Search Bar */}
            <View style={styles.searchSection}>
              <Input
                placeholder="Tìm nhà hàng, trà sữa, pizza, phở..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                leftIcon={<Text style={styles.searchIcon}>🔍</Text>}
                rightIcon={
                  searchQuery ? (
                    <Pressable onPress={() => setSearchQuery("")}>
                      <Text style={styles.clearSearch}>✕</Text>
                    </Pressable>
                  ) : null
                }
              />
            </View>

            {/* Promotion Banner */}
            <View style={styles.heroCard}>
              <View style={styles.heroTextContainer}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>🔥 ƯU ĐÃI ĐẶC BIỆT</Text>
                </View>
                <Text style={styles.heroTitle}>
                  Khuyến Mãi Siêu Tiệc 50%
                </Text>
                <Text style={styles.heroSubtitle}>
                  Nhập mã voucher ngay khi đặt đơn để nhận giảm giá hấp dẫn!
                </Text>
              </View>
              <Text style={styles.heroDroneBig}>🎁</Text>
            </View>

            {/* Category Pills Carousel */}
            <View style={styles.categorySection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.categoryChipSelected,
                      ]}
                      onPress={() => setSelectedCategory(cat.id)}
                    >
                      <Text style={styles.catIcon}>{cat.icon}</Text>
                      <Text
                        style={[
                          styles.catName,
                          isSelected && styles.catNameSelected,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionHeading}>Nhà hàng gần bạn</Text>
              <Text style={styles.sectionMeta}>
                Bán kính 15km • {filteredRestaurants.length} quán
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {loading ? (
              <>
                <Text style={styles.emptyIcon}>⏳</Text>
                <Text style={styles.emptyTitle}>Đang tìm nhà hàng quanh bạn...</Text>
                <Text style={styles.emptyText}>Vui lòng chờ trong giây lát...</Text>
              </>
            ) : !hasLocation ? (
              <>
                <Text style={styles.emptyIcon}>🎯</Text>
                <Text style={styles.emptyTitle}>Chưa định vị vị trí của bạn</Text>
                <Text style={styles.emptyText}>
                  Hãy cho phép định vị GPS để DroneFood tìm kiếm các nhà hàng hoạt động trong bán kính 15km quanh bạn.
                </Text>
                <Pressable
                  style={styles.emptyButton}
                  onPress={onLocateGps}
                  disabled={locating}
                >
                  <Text style={styles.emptyButtonText}>
                    {locating ? "Đang định vị..." : "🎯 Bật định vị GPS ngay"}
                  </Text>
                </Pressable>
              </>
            ) : restaurants.length === 0 ? (
              <>
                <Text style={styles.emptyIcon}>🛸</Text>
                <Text style={styles.emptyTitle}>Không có quán nào trong bán kính 15km</Text>
                <Text style={styles.emptyText}>
                  Hiện tại không có nhà hàng đối tác nào hoạt động trong phạm vi giao hàng bằng Drone quanh vị trí này.
                </Text>
                <Pressable
                  style={styles.emptyButton}
                  onPress={onLocateGps}
                  disabled={locating}
                >
                  <Text style={styles.emptyButtonText}>
                    {locating ? "Đang định vị lại..." : "🔄 Cập nhật lại vị trí"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>Không tìm thấy quán phù hợp</Text>
                <Text style={styles.emptyText}>
                  Không có quán nào phù hợp với bộ lọc &quot;{searchQuery || selectedCategory}&quot;. Hãy thử tìm từ khóa khác.
                </Text>
                <Pressable
                  style={[
                    styles.emptyButton,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                >
                  <Text style={[styles.emptyButtonText, { color: colors.textPrimary }]}>
                    🔄 Xóa bộ lọc
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.restaurantCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() => onSelectRestaurant(item)}
          >
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={styles.restaurantImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.restaurantImageFallback}>
                <Text style={styles.fallbackIcon}>🏪</Text>
              </View>
            )}

            <View style={styles.restaurantInfo}>
              <View style={styles.cardHeaderRow}>
                <Text numberOfLines={1} style={styles.restaurantName}>
                  {item.name}
                </Text>
                <Badge status={item.isOpen !== false ? "open" : "closed"} />
              </View>

              <View style={styles.cardMetaRow}>
                <View style={styles.ratingBadge}>
                  <Text style={styles.starIcon}>★</Text>
                  <Text style={styles.ratingText}>
                    {item.averageRating != null
                      ? `${item.averageRating.toFixed(1)}${item.ratingCount ? ` (${item.ratingCount})` : ""}`
                      : item.rating
                      ? item.rating.toFixed(1)
                      : "Mới"}
                  </Text>
                </View>

                <Text style={styles.timeText}>⏱️ 15-20 phút</Text>

                {item.distanceKm !== null && item.distanceKm !== undefined ? (
                  <Text style={styles.distanceText}>
                    📍 {formatDistance(item.distanceKm)}
                  </Text>
                ) : null}
              </View>

              <View style={styles.cardFooterRow}>
                <Badge status="drone" label="🛸 Drone Ready" />
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  locationBar: {
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  locationLeft: {
    flex: 1,
  },
  deliverLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deliverLabel: {
    ...typography.micro,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  addressLineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    marginTop: 2,
  },
  deliverChangeBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  deliverChangeText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  addressText: {
    ...typography.subhead,
    color: colors.textPrimary,
    flex: 1,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 4,
    marginBottom: 4,
  },
  timeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  gpsIcon: {
    fontSize: 14,
  },
  gpsText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 110,
  },
  searchSection: {
    marginBottom: spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  clearSearch: {
    fontSize: 16,
    color: colors.textSecondary,
    paddingHorizontal: spacing.xs,
  },
  heroCard: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  heroTextContainer: {
    flex: 1,
    gap: spacing.xxs,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0, 102, 204, 0.4)",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginBottom: 4,
  },
  heroBadgeText: {
    ...typography.micro,
    color: "#93C5FD",
    fontWeight: "700",
  },
  heroTitle: {
    ...typography.title2,
    color: "#FFFFFF",
  },
  heroSubtitle: {
    ...typography.caption,
    color: "#94A3B8",
  },
  heroDroneBig: {
    fontSize: 48,
    marginLeft: spacing.sm,
  },
  categorySection: {
    marginBottom: spacing.md,
  },
  categoryScroll: {
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catIcon: {
    fontSize: 16,
  },
  catName: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  catNameSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.xs,
  },
  sectionHeading: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  sectionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  restaurantCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.995 }],
  },
  restaurantImage: {
    width: "100%",
    height: 140,
    backgroundColor: colors.surfaceSubtle,
  },
  restaurantImageFallback: {
    width: "100%",
    height: 140,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackIcon: {
    fontSize: 42,
  },
  restaurantInfo: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  restaurantName: {
    ...typography.subhead,
    color: colors.textPrimary,
    flex: 1,
  },
  restaurantAddress: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xxs,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  starIcon: {
    color: "#F59E0B",
    fontSize: 14,
  },
  ratingText: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  distanceText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptyText: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  emptyButtonText: {
    ...typography.subhead,
    color: "#fff",
    fontWeight: "700",
  },
});
