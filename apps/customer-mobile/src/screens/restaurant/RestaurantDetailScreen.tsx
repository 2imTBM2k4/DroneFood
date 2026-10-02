import React, { useMemo, useState } from "react";
import { FlatList, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatDistance } from "../../api/client";
import { EmptyState } from "../../components/common/EmptyState";
import { FilterChip } from "../../components/common/FilterChip";
import { Header } from "../../components/common/Header";
import { Icon } from "../../components/common/Icon";
import { FoodCard } from "../../components/food/FoodCard";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { Food, Restaurant } from "../../types";

interface RestaurantDetailScreenProps {
  restaurant: Restaurant;
  foods: Food[];
  loading: boolean;
  onBack: () => void;
  onSelectFood: (food: Food) => void;
}

export const RestaurantDetailScreen: React.FC<RestaurantDetailScreenProps> = ({
  restaurant,
  foods,
  loading,
  onBack,
  onSelectFood,
}) => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const categories = useMemo(
    () => ["all", ...Array.from(new Set(foods.map((food) => food.category).filter(Boolean) as string[]))],
    [foods]
  );
  const filtered = useMemo(
    () => (selectedCategory === "all" ? foods : foods.filter((food) => food.category === selectedCategory)),
    [foods, selectedCategory]
  );

  type RestaurantMenuListItem = Food | { _id: string; isEmptySpacer: true };

  const listData: RestaurantMenuListItem[] = useMemo(() => {
    if (filtered.length % 2 !== 0) {
      return [...filtered, { _id: "__empty_spacer__", isEmptySpacer: true }];
    }
    return filtered;
  }, [filtered]);

  const rating = restaurant.averageRating ?? restaurant.rating;

  return (
    <View style={styles.screen}>
      <Header title="Thực đơn" subtitle={restaurant.name} onBack={onBack} />
      <FlatList
        data={listData}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            {/* Hero Image with Dark Gradient Scrim */}
            <View style={styles.hero}>
              {restaurant.image ? (
                <Image source={{ uri: restaurant.image }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={styles.heroFallback}>
                  <Icon name="store" size={50} color={colors.primary} />
                </View>
              )}
              {/* Dark Gradient Scrim ensuring WCAG AA >= 4.5:1 text readability */}
              <LinearGradient
                colors={["transparent", "rgba(0, 0, 0, 0.45)", "rgba(0, 0, 0, 0.88)"]}
                style={styles.heroScrim}
              />
              <View style={styles.heroPanel}>
                <View style={styles.titleRow}>
                  <Text numberOfLines={2} style={styles.restaurantName}>
                    {restaurant.name}
                  </Text>
                  <View style={[styles.statusDot, restaurant.isOpen === false && styles.closedDot]} />
                </View>
                <Text numberOfLines={1} style={styles.address}>
                  {restaurant.address}
                </Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Icon name="star" size={14} color="#FBBF24" variant="solid" />
                    <Text style={styles.metaTextWhite}>
                      {rating != null ? rating.toFixed(1) : "Mới"}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="clock" size={14} color="rgba(255, 255, 255, 0.85)" />
                    <Text style={styles.metaTextWhite}>15–20 phút</Text>
                  </View>
                  {restaurant.distanceKm != null ? (
                    <View style={styles.metaItem}>
                      <Icon name="map-pin" size={14} color="rgba(255, 255, 255, 0.85)" />
                      <Text style={styles.metaTextWhite}>{formatDistance(restaurant.distanceKm)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {restaurant.description ? (
              <Text style={styles.description}>{restaurant.description}</Text>
            ) : null}

            {/* Category Filter Chips */}
            {categories.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categories}
              >
                {categories.map((category) => (
                  <FilterChip
                    key={category}
                    label={category === "all" ? "Tất cả món" : category}
                    selected={category === selectedCategory}
                    onPress={() => setSelectedCategory(category)}
                  />
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Thực đơn quán</Text>
              <Text style={styles.count}>{filtered.length} món</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <EmptyState
            title={loading ? "Đang tải thực đơn..." : "Chưa có món trong mục này"}
            description={loading ? "Vui lòng đợi giây lát" : "Hãy chọn danh mục khác để xem món ăn"}
            iconName="utensils"
          />
        )}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => {
          if ("isEmptySpacer" in item && item.isEmptySpacer) {
            return <View style={styles.spacerCard} pointerEvents="none" />;
          }
          return <FoodCard food={item as Food} onSelect={onSelectFood} />;
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    padding: spacing.screenPadding,
    paddingBottom: 132,
  },
  columnWrapper: {
    gap: spacing.md,
  },
  spacerCard: {
    flex: 1,
    marginBottom: spacing.md,
  },
  headerContent: {
    gap: spacing.md,
  },
  hero: {
    height: 280,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  heroScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "65%",
  },
  heroPanel: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: 6,
    zIndex: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  restaurantName: {
    ...typography.screenTitle,
    fontSize: 22,
    color: colors.textWhite,
    flex: 1,
    lineHeight: 26,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  closedDot: {
    backgroundColor: colors.danger,
  },
  address: {
    ...typography.caption,
    color: "rgba(255, 255, 255, 0.85)",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaTextWhite: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textWhite,
  },
  description: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: spacing.xxs,
  },
  categories: {
    gap: spacing.xs,
    paddingRight: spacing.screenPadding,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    fontSize: 18,
    color: colors.textPrimary,
  },
  count: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },
});
