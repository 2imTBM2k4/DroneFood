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
import { Header } from "../../components/common/Header";
import { FoodCard } from "../../components/food/FoodCard";
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
  const [selectedCat, setSelectedCat] = useState("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    foods.forEach((f) => {
      if (f.category) set.add(f.category);
    });
    return ["all", ...Array.from(set)];
  }, [foods]);

  const filteredFoods = useMemo(() => {
    if (selectedCat === "all") return foods;
    return foods.filter((f) => f.category === selectedCat);
  }, [foods, selectedCat]);

  return (
    <View style={styles.container}>
      <Header
        title={restaurant.name}
        subtitle={restaurant.rating ? `${restaurant.rating.toFixed(1)} ⭐ • Drone Delivery Ready` : "Drone Delivery Ready"}
        onBack={onBack}
      />

      <FlatList
        data={filteredFoods}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Restaurant Hero Banner */}
            <View style={styles.heroWrapper}>
              {restaurant.image ? (
                <Image
                  source={{ uri: restaurant.image }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.heroFallback}>
                  <Text style={styles.heroFallbackText}>🏪</Text>
                </View>
              )}
              <View style={styles.heroOverlay}>
                <View style={styles.badgesRow}>
                  <Badge
                    status={restaurant.isOpen !== false ? "open" : "closed"}
                  />
                  <Badge status="drone" label="🛸 Giao hàng Drone" />
                </View>
              </View>
            </View>

            {/* Restaurant Meta Details */}
            <View style={styles.metaCard}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>

              {restaurant.description ? (
                <Text style={styles.descriptionText}>
                  {restaurant.description}
                </Text>
              ) : null}

              <View style={styles.metaRow}>
                <Text style={styles.metaItem}>
                  ⭐ {restaurant.averageRating != null
                    ? `${restaurant.averageRating.toFixed(1)} (${restaurant.ratingCount || 0} đánh giá)`
                    : restaurant.rating
                    ? `${restaurant.rating.toFixed(1)}`
                    : "Chưa có đánh giá"}
                </Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaItem}>⏱️ Giao dự kiến 15-20 phút</Text>
                {restaurant.distanceKm !== null && restaurant.distanceKm !== undefined ? (
                  <>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.metaItem}>📍 {formatDistance(restaurant.distanceKm)}</Text>
                  </>
                ) : null}
              </View>
            </View>

            {/* Category Filter Pills */}
            {categories.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {categories.map((cat) => {
                  const isSelected = selectedCat === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[
                        styles.catPill,
                        isSelected && styles.catPillSelected,
                      ]}
                      onPress={() => setSelectedCat(cat)}
                    >
                      <Text
                        style={[
                          styles.catPillText,
                          isSelected && styles.catPillTextSelected,
                        ]}
                      >
                        {cat === "all" ? "Tất cả thực đơn" : cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <Text style={styles.menuTitle}>
              Thực đơn ({filteredFoods.length} món)
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? "Đang tải thực đơn..." : "Quán chưa có món trong mục này."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <FoodCard food={item} onSelect={onSelectFood} />
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
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: 110,
  },
  heroWrapper: {
    height: 160,
    borderRadius: radius.lg,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.surfaceSubtle,
    marginBottom: spacing.sm,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  heroFallbackText: {
    fontSize: 50,
  },
  heroOverlay: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
  },
  badgesRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  metaCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  restaurantName: {
    ...typography.title1,
    color: colors.textPrimary,
  },
  restaurantAddress: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
  descriptionText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  metaItem: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  metaDot: {
    color: colors.textMuted,
  },
  categoryScroll: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  catPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catPillText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  catPillTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  menuTitle: {
    ...typography.title2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    marginBottom: spacing.xxs,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
});
