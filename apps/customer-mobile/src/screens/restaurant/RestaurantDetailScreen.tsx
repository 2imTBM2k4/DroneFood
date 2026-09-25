import React, { useMemo, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../../api/client";
import { GlassSurface } from "../../components/common/GlassSurface";
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

export const RestaurantDetailScreen: React.FC<RestaurantDetailScreenProps> = ({ restaurant, foods, loading, onBack, onSelectFood }) => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const categories = useMemo(() => ["all", ...Array.from(new Set(foods.map((food) => food.category).filter(Boolean) as string[]))], [foods]);
  const filtered = useMemo(() => selectedCategory === "all" ? foods : foods.filter((food) => food.category === selectedCategory), [foods, selectedCategory]);
  const rating = restaurant.averageRating ?? restaurant.rating;

  return (
    <View style={styles.screen}>
      <Header title="Thực đơn" subtitle={restaurant.name} onBack={onBack} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={styles.hero}>
              {restaurant.image ? <Image source={{ uri: restaurant.image }} style={styles.heroImage} resizeMode="cover" /> : <View style={styles.heroFallback}><Icon name="store" size={50} color={colors.primary} /></View>}
              <GlassSurface style={styles.heroPanel} contentStyle={styles.heroPanelContent} tone="strong" intensity={72}>
                <View style={styles.titleRow}>
                  <Text numberOfLines={2} style={styles.restaurantName}>{restaurant.name}</Text>
                  <View style={[styles.statusDot, restaurant.isOpen === false && styles.closedDot]} />
                </View>
                <Text numberOfLines={1} style={styles.address}>{restaurant.address}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}><Icon name="star" size={14} color={colors.primary} /><Text style={styles.metaText}>{rating != null ? rating.toFixed(1) : "Mới"}</Text></View>
                  <View style={styles.metaItem}><Icon name="clock" size={14} color={colors.primary} /><Text style={styles.metaText}>15–20 phút</Text></View>
                  {restaurant.distanceKm != null ? <View style={styles.metaItem}><Icon name="map-pin" size={14} color={colors.primary} /><Text style={styles.metaText}>{formatDistance(restaurant.distanceKm)}</Text></View> : null}
                </View>
              </GlassSurface>
            </View>

            {restaurant.description ? <Text style={styles.description}>{restaurant.description}</Text> : null}

            {categories.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
                {categories.map((category) => {
                  const selected = category === selectedCategory;
                  return <Pressable key={category} onPress={() => setSelectedCategory(category)} style={[styles.category, selected && styles.categorySelected]}><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{category === "all" ? "Tất cả món" : category}</Text></Pressable>;
                })}
              </ScrollView>
            ) : null}

            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Thực đơn</Text><Text style={styles.count}>{filtered.length} món</Text></View>
          </View>
        )}
        ListEmptyComponent={<GlassSurface tone="soft" contentStyle={styles.empty}><Icon name={loading ? "refresh" : "utensils"} size={30} color={colors.primary} /><Text style={styles.emptyTitle}>{loading ? "Đang tải thực đơn..." : "Chưa có món trong danh mục này"}</Text></GlassSurface>}
        renderItem={({ item }) => <FoodCard food={item} onSelect={onSelectFood} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  list: { padding: spacing.md, paddingBottom: 132, gap: spacing.md },
  headerContent: { gap: spacing.md },
  hero: { height: 292, borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.glassBorder },
  heroImage: { width: "100%", height: "100%" },
  heroFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight },
  heroPanel: { position: "absolute", left: spacing.sm, right: spacing.sm, bottom: spacing.sm },
  heroPanelContent: { padding: spacing.md, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  restaurantName: { ...typography.title1, color: colors.textPrimary, flex: 1, lineHeight: 28 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success, marginTop: 8 },
  closedDot: { backgroundColor: colors.danger },
  address: { ...typography.caption, color: colors.textSecondary },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: 2 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { ...typography.captionBold, color: colors.textPrimary },
  description: { ...typography.bodySecondary, color: colors.textSecondary, lineHeight: 21, paddingHorizontal: spacing.xs },
  categories: { gap: spacing.xs, paddingRight: spacing.md },
  category: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.glassFillStrong, borderWidth: 1, borderColor: colors.glassBorder },
  categorySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { ...typography.captionBold, color: colors.textSecondary },
  categoryTextSelected: { color: colors.textWhite },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  sectionTitle: { ...typography.title1, color: colors.textPrimary },
  count: { ...typography.captionBold, color: colors.primary },
  empty: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  emptyTitle: { ...typography.body, color: colors.textSecondary },
});
