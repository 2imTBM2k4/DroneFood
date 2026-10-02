import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { foodApi, formatDistance, formatVnd } from "../../api/client";
import { FilterChip } from "../../components/common/FilterChip";
import { Icon, type IconName } from "../../components/common/Icon";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { Food, Restaurant } from "../../types";
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  removeSearchHistory,
} from "./searchHistory";

export interface SearchScreenProps {
  restaurants: Restaurant[];
  onBack: () => void;
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onSelectFood: (food: Food, restaurant?: Restaurant) => void;
  initialQuery?: string;
}

type ResultTab = "all" | "restaurants" | "foods";
type FilterOption = "all" | "nearest" | "top_rated" | "drone";

interface TrendingItem {
  id: string;
  keyword: string;
  badge?: string;
  icon?: IconName;
}

const TRENDING_SEARCHES: TrendingItem[] = [
  { id: "1", keyword: "Trà sữa", badge: "HOT 🔥", icon: "coffee" },
  { id: "2", keyword: "Cơm tấm", badge: "Top 1 🍚", icon: "utensils" },
  { id: "3", keyword: "Gà rán", icon: "utensils" },
  { id: "4", keyword: "Pizza phô mai", badge: "Ưu đãi", icon: "pizza" },
  { id: "5", keyword: "Cà phê muối", icon: "coffee" },
  { id: "6", keyword: "Phở & Bún", icon: "utensils" },
  { id: "7", keyword: "Bánh mì", icon: "utensils" },
  { id: "8", keyword: "Drone siêu tốc", badge: "⚡ 15p", icon: "drone" },
];

const SEARCH_CATEGORIES: { id: string; name: string; keyword: string; icon: IconName }[] = [
  { id: "milktea", name: "Trà sữa", keyword: "trà sữa", icon: "coffee" },
  { id: "rice", name: "Cơm tấm", keyword: "cơm", icon: "utensils" },
  { id: "pizza", name: "Pizza", keyword: "pizza", icon: "pizza" },
  { id: "noodles", name: "Phở & Mì", keyword: "phở", icon: "utensils" },
  { id: "dessert", name: "Tráng miệng", keyword: "chè", icon: "cake" },
  { id: "healthy", name: "Healthy", keyword: "salad", icon: "leaf" },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  milktea: ["trà sữa", "milk tea", "boba", "trà", "coffee", "cà phê"],
  rice: ["cơm", "rice", "sườn", "tấm"],
  pizza: ["pizza", "pasta", "ý"],
  noodles: ["mì", "phở", "bún", "hủ tiếu", "miến", "ramen"],
  dessert: ["chè", "bánh", "kem", "tráng miệng", "dessert"],
  healthy: ["salad", "healthy", "chay", "rau", "nước ép", "juice"],
};

export const SearchScreen: React.FC<SearchScreenProps> = ({
  restaurants,
  onBack,
  onSelectRestaurant,
  onSelectFood,
  initialQuery = "",
}) => {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [history, setHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ResultTab>("all");
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");

  const [searchedFoods, setSearchedFoods] = useState<Food[]>([]);
  const [foodsLoading, setFoodsLoading] = useState(false);

  // Load search history on mount
  useEffect(() => {
    getSearchHistory().then(setHistory);
  }, []);

  // Sync initial query if passed
  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
      setSubmittedQuery(initialQuery.trim());
      addSearchHistory(initialQuery.trim()).then(setHistory);
    }
  }, [initialQuery]);

  // Restaurant Map by ID for quick food restaurant lookup
  const restaurantMap = useMemo(
    () => new Map(restaurants.map((r) => [String(r._id), r])),
    [restaurants]
  );

  // Search Foods from API when submittedQuery changes
  const executeFoodSearch = useCallback(async (keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setSearchedFoods([]);
      setFoodsLoading(false);
      return;
    }
    setFoodsLoading(true);
    try {
      const foods = await foodApi.list({ q: trimmed });
      setSearchedFoods(foods);
    } catch {
      setSearchedFoods([]);
    } finally {
      setFoodsLoading(false);
    }
  }, []);

  // Debounced auto-search when user types
  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      setSubmittedQuery(trimmed);
      if (trimmed) {
        executeFoodSearch(trimmed);
      } else {
        setSearchedFoods([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, executeFoodSearch]);

  const handleCommitSearch = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim();
      setQuery(trimmed);
      setSubmittedQuery(trimmed);
      if (trimmed) {
        addSearchHistory(trimmed).then(setHistory);
        executeFoodSearch(trimmed);
      }
      Keyboard.dismiss();
    },
    [executeFoodSearch]
  );

  const handleClearHistory = useCallback(async () => {
    await clearSearchHistory();
    setHistory([]);
  }, []);

  const handleRemoveHistoryItem = useCallback(async (item: string) => {
    const updated = await removeSearchHistory(item);
    setHistory(updated);
  }, []);

  // Filter restaurants
  const matchedRestaurants = useMemo(() => {
    const term = submittedQuery.toLowerCase().trim();
    if (!term) return [];

    let list = restaurants.filter((restaurant) => {
      const haystack = `${restaurant.name} ${restaurant.address} ${
        restaurant.description || ""
      }`.toLowerCase();

      // Check text match
      if (haystack.includes(term)) return true;

      // Check category match
      for (const [catKey, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((k) => term.includes(k) || k.includes(term))) {
          if (haystack.includes(catKey) || keywords.some((k) => haystack.includes(k))) {
            return true;
          }
        }
      }
      return false;
    });

    // Apply secondary filters
    if (activeFilter === "nearest") {
      list = [...list].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    } else if (activeFilter === "top_rated") {
      list = list.filter((r) => (r.averageRating ?? r.rating ?? 0) >= 4.5);
    }

    return list;
  }, [restaurants, submittedQuery, activeFilter]);

  // Filter foods
  const matchedFoods = useMemo(() => {
    if (!submittedQuery.trim()) return [];
    let list = searchedFoods;

    if (activeFilter === "nearest") {
      list = [...list].sort((a, b) => {
        const restA = a.restaurantId ? restaurantMap.get(String(a.restaurantId)) : undefined;
        const restB = b.restaurantId ? restaurantMap.get(String(b.restaurantId)) : undefined;
        return (restA?.distanceKm ?? 999) - (restB?.distanceKm ?? 999);
      });
    }

    return list;
  }, [searchedFoods, submittedQuery, activeFilter, restaurantMap]);

  const hasSearchTerm = Boolean(submittedQuery.trim());
  const hasNoResults =
    hasSearchTerm &&
    !foodsLoading &&
    matchedRestaurants.length === 0 &&
    matchedFoods.length === 0;

  return (
    <View style={styles.screen}>
      {/* Top Search Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {/* Back Button (Touch target >= 44x44) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            hitSlop={10}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Icon name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>

          {/* Search Input Box */}
          <View style={styles.inputContainer}>
            <Icon name="search" size={18} color={colors.primary} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Tìm món ngon, quán ăn, trà sữa..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => handleCommitSearch(query)}
              returnKeyType="search"
              autoFocus={true}
              clearButtonMode="never"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityRole="search"
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xóa nội dung tìm kiếm"
                hitSlop={12}
                onPress={() => {
                  setQuery("");
                  setSubmittedQuery("");
                  setSearchedFoods([]);
                  inputRef.current?.focus();
                }}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              >
                <Icon name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {/* Action Button: "Tìm" */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tìm kiếm"
            onPress={() => handleCommitSearch(query)}
            style={({ pressed }) => [styles.searchAction, pressed && styles.pressed]}
          >
            <Text style={styles.searchActionText}>Tìm</Text>
          </Pressable>
        </View>

        {/* Results Tab Bar & Filters (Visible when search query is entered) */}
        {hasSearchTerm ? (
          <View style={styles.subHeader}>
            {/* Main Result Tabs */}
            <View style={styles.tabBar}>
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel="Tất cả kết quả"
                accessibilityState={{ selected: activeTab === "all" }}
                onPress={() => setActiveTab("all")}
                style={[styles.tabItem, activeTab === "all" && styles.tabItemActive]}
              >
                <Text
                  style={[styles.tabLabel, activeTab === "all" && styles.tabLabelActive]}
                >
                  Tất cả ({matchedRestaurants.length + matchedFoods.length})
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="tab"
                accessibilityLabel="Kết quả Quán ăn"
                accessibilityState={{ selected: activeTab === "restaurants" }}
                onPress={() => setActiveTab("restaurants")}
                style={[
                  styles.tabItem,
                  activeTab === "restaurants" && styles.tabItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === "restaurants" && styles.tabLabelActive,
                  ]}
                >
                  Quán ăn ({matchedRestaurants.length})
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="tab"
                accessibilityLabel="Kết quả Món ăn"
                accessibilityState={{ selected: activeTab === "foods" }}
                onPress={() => setActiveTab("foods")}
                style={[
                  styles.tabItem,
                  activeTab === "foods" && styles.tabItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === "foods" && styles.tabLabelActive,
                  ]}
                >
                  Món ăn ({matchedFoods.length})
                </Text>
              </Pressable>
            </View>

            {/* Quick Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipScroll}
            >
              <FilterChip
                label="Tất cả"
                selected={activeFilter === "all"}
                onPress={() => setActiveFilter("all")}
              />
              <FilterChip
                label="Gần tôi nhất"
                selected={activeFilter === "nearest"}
                onPress={() =>
                  setActiveFilter(activeFilter === "nearest" ? "all" : "nearest")
                }
              />
              <FilterChip
                label="Đánh giá cao (★ 4.5+)"
                selected={activeFilter === "top_rated"}
                onPress={() =>
                  setActiveFilter(activeFilter === "top_rated" ? "all" : "top_rated")
                }
              />
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Main Content Area */}
      {!hasSearchTerm ? (
        /* ========================================================================= */
        /* DEFAULT STATE: RECENT SEARCHES + TRENDING KEYWORDS + CATEGORIES           */
        /* ========================================================================= */
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollBodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section 1: Lịch sử tìm kiếm (Recent Searches) */}
          {history.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <Icon name="clock" size={18} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Tìm kiếm gần đây</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xóa lịch sử tìm kiếm"
                  hitSlop={10}
                  onPress={handleClearHistory}
                  style={({ pressed }) => [styles.clearHistoryButton, pressed && styles.pressed]}
                >
                  <Icon name="trash" size={15} color={colors.textSecondary} />
                  <Text style={styles.clearHistoryText}>Xóa tất cả</Text>
                </Pressable>
              </View>

              <View style={styles.chipWrap}>
                {history.map((item, index) => (
                  <View key={`hist-${index}`} style={styles.historyChip}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Tìm lại ${item}`}
                      onPress={() => handleCommitSearch(item)}
                      style={({ pressed }) => [
                        styles.historyChipTextWrap,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.historyChipText} numberOfLines={1}>
                        {item}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa từ khóa ${item}`}
                      hitSlop={8}
                      onPress={() => handleRemoveHistoryItem(item)}
                      style={({ pressed }) => [
                        styles.historyChipRemove,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon name="close" size={13} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Section 2: Tìm kiếm thịnh hành (Trending Searches) */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleWithIcon}>
                <Icon name="sparkles" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Món hot tìm nhiều nhất</Text>
              </View>
            </View>

            <View style={styles.trendingGrid}>
              {TRENDING_SEARCHES.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Tìm từ khóa ${item.keyword}`}
                  onPress={() => handleCommitSearch(item.keyword)}
                  style={({ pressed }) => [
                    styles.trendingCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.trendingLeft}>
                    {item.icon ? (
                      <View style={styles.trendingIconWrap}>
                        <Icon name={item.icon} size={15} color={colors.primary} />
                      </View>
                    ) : null}
                    <Text style={styles.trendingText} numberOfLines={1}>
                      {item.keyword}
                    </Text>
                  </View>
                  {item.badge ? (
                    <View style={styles.trendingBadge}>
                      <Text style={styles.trendingBadgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 3: Gợi ý danh mục (Explore Categories) */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleWithIcon}>
                <Icon name="utensils" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Khám phá danh mục</Text>
              </View>
            </View>

            <View style={styles.categoryGrid}>
              {SEARCH_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Tìm món trong danh mục ${cat.name}`}
                  onPress={() => handleCommitSearch(cat.keyword)}
                  style={({ pressed }) => [
                    styles.categoryCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.categoryIconWrap}>
                    <Icon name={cat.icon} size={22} color={colors.primary} />
                  </View>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        /* ========================================================================= */
        /* RESULTS STATE: MATCHED RESTAURANTS AND FOODS                              */
        /* ========================================================================= */
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.resultsBodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {foodsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Đang tìm món ngon phù hợp...</Text>
            </View>
          ) : null}

          {/* Empty State */}
          {hasNoResults ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Icon name="search" size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Không tìm thấy kết quả</Text>
              <Text style={styles.emptySubtitle}>
                Không có món hoặc quán nào khớp với &quot;{submittedQuery}&quot;. Bạn thử tìm từ
                khóa khác nhé!
              </Text>

              {/* Suggestions to try */}
              <View style={styles.emptySuggestions}>
                <Text style={styles.emptySuggestionsTitle}>Gợi ý từ khóa hot:</Text>
                <View style={styles.chipWrap}>
                  {["Trà sữa", "Cơm tấm", "Pizza", "Gà rán"].map((tag, idx) => (
                    <Pressable
                      key={idx}
                      accessibilityRole="button"
                      accessibilityLabel={`Tìm ${tag}`}
                      onPress={() => handleCommitSearch(tag)}
                      style={({ pressed }) => [
                        styles.emptyChip,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.emptyChipText}>{tag}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {/* --------------------------------------------------------------------- */}
          {/* Section: Nhà hàng (Restaurants)                                       */}
          {/* --------------------------------------------------------------------- */}
          {(activeTab === "all" || activeTab === "restaurants") &&
          matchedRestaurants.length > 0 ? (
            <View style={styles.resultSection}>
              <View style={styles.resultSectionHeader}>
                <Text style={styles.resultSectionTitle}>
                  Nhà hàng ({matchedRestaurants.length})
                </Text>
              </View>

              {matchedRestaurants.map((restaurant) => (
                <Pressable
                  key={restaurant._id}
                  accessibilityRole="button"
                  accessibilityLabel={`Nhà hàng ${restaurant.name}`}
                  onPress={() => {
                    addSearchHistory(submittedQuery).catch(() => undefined);
                    onSelectRestaurant(restaurant);
                  }}
                  style={({ pressed }) => [
                    styles.restaurantCard,
                    pressed && styles.cardPressed,
                  ]}
                >
                  {restaurant.image ? (
                    <Image
                      source={{ uri: restaurant.image }}
                      style={styles.restaurantImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.restaurantImageFallback}>
                      <Icon name="store" size={28} color={colors.primary} />
                    </View>
                  )}

                  <View style={styles.restaurantInfo}>
                    <View style={styles.restaurantTopRow}>
                      <Text style={styles.restaurantName} numberOfLines={1}>
                        {restaurant.name}
                      </Text>
                      <View
                        style={[
                          styles.openDot,
                          restaurant.isOpen === false && styles.closedDot,
                        ]}
                      />
                    </View>

                    <Text style={styles.restaurantAddress} numberOfLines={1}>
                      {restaurant.description || restaurant.address}
                    </Text>

                    <View style={styles.restaurantMetaRow}>
                      <View style={styles.metaItem}>
                        <Icon name="star" size={13} color="#FBBF24" variant="solid" />
                        <Text style={styles.metaRatingText}>
                          {restaurant.averageRating?.toFixed(1) ||
                            restaurant.rating?.toFixed(1) ||
                            "4.8"}
                        </Text>
                      </View>

                      {restaurant.distanceKm != null ? (
                        <View style={styles.metaItem}>
                          <Icon name="drone" size={13} color={colors.primary} />
                          <Text style={styles.metaDistanceText}>
                            {formatDistance(restaurant.distanceKm)}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.droneBadge}>
                        <Text style={styles.droneBadgeText}>Giao Drone ~15p</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* --------------------------------------------------------------------- */}
          {/* Section: Món ăn (Food Items)                                         */}
          {/* --------------------------------------------------------------------- */}
          {(activeTab === "all" || activeTab === "foods") &&
          matchedFoods.length > 0 ? (
            <View style={styles.resultSection}>
              <View style={styles.resultSectionHeader}>
                <Text style={styles.resultSectionTitle}>
                  Món ăn ngon ({matchedFoods.length})
                </Text>
              </View>

              {matchedFoods.map((food) => {
                const parentRestaurant = food.restaurantId
                  ? restaurantMap.get(String(food.restaurantId))
                  : undefined;
                return (
                  <Pressable
                    key={food._id}
                    accessibilityRole="button"
                    accessibilityLabel={`Món ${food.name}, giá ${formatVnd(food.price)}`}
                    onPress={() => {
                      addSearchHistory(submittedQuery).catch(() => undefined);
                      onSelectFood(food, parentRestaurant);
                    }}
                    style={({ pressed }) => [
                      styles.foodCard,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    {food.image ? (
                      <Image
                        source={{ uri: food.image }}
                        style={styles.foodImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.foodImageFallback}>
                        <Icon name="utensils" size={24} color={colors.primary} />
                      </View>
                    )}

                    <View style={styles.foodInfo}>
                      <Text style={styles.foodName} numberOfLines={1}>
                        {food.name}
                      </Text>

                      {parentRestaurant ? (
                        <View style={styles.foodRestaurantRow}>
                          <Icon name="store" size={12} color={colors.textSecondary} />
                          <Text style={styles.foodRestaurantName} numberOfLines={1}>
                            {parentRestaurant.name}
                          </Text>
                        </View>
                      ) : null}

                      {food.description ? (
                        <Text style={styles.foodDescription} numberOfLines={1}>
                          {food.description}
                        </Text>
                      ) : null}

                      <View style={styles.foodBottomRow}>
                        <Text style={styles.foodPrice}>{formatVnd(food.price)}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Đặt món ${food.name}`}
                          onPress={() => {
                            addSearchHistory(submittedQuery).catch(() => undefined);
                            onSelectFood(food, parentRestaurant);
                          }}
                          style={({ pressed }) => [
                            styles.foodAddButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.foodAddButtonText}>+ Đặt món</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    zIndex: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.xs,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.pill,
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderHairline,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  clearButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  searchAction: {
    minWidth: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  searchActionText: {
    ...typography.foodTitle,
    color: colors.primary,
    fontWeight: "600",
  },
  subHeader: {
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  filterChipScroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 4,
    gap: spacing.xs,
  },
  scrollBody: {
    flex: 1,
  },
  scrollBodyContent: {
    padding: spacing.screenPadding,
    paddingBottom: 40,
    gap: spacing.xl,
  },
  resultsBodyContent: {
    padding: spacing.screenPadding,
    paddingBottom: 40,
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionTitleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
  },
  clearHistoryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    minHeight: 36,
  },
  clearHistoryText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  historyChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingLeft: 12,
    paddingRight: 6,
    height: 36,
  },
  historyChipTextWrap: {
    maxWidth: 160,
    paddingRight: 4,
  },
  historyChipText: {
    ...typography.bodySecondary,
    color: colors.textPrimary,
  },
  historyChipRemove: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  trendingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  trendingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderHairline,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    minHeight: 40,
  },
  trendingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendingIconWrap: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.badgeTintBg,
    justifyContent: "center",
    alignItems: "center",
  },
  trendingText: {
    ...typography.bodySecondary,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  trendingBadge: {
    backgroundColor: colors.badgeTintBg,
    borderRadius: radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  trendingBadgeText: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: "600",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryCard: {
    width: "31%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderHairline,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    gap: 6,
  },
  categoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderHairline,
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptySubtitle: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  emptySuggestions: {
    marginTop: spacing.md,
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  emptySuggestionsTitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyChip: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
    justifyContent: "center",
  },
  emptyChipText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "500",
  },
  resultSection: {
    gap: spacing.xs,
  },
  resultSectionHeader: {
    paddingVertical: 4,
  },
  resultSectionTitle: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
  },
  restaurantCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderHairline,
    gap: 12,
    alignItems: "center",
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  restaurantImage: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
  },
  restaurantImageFallback: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  restaurantInfo: {
    flex: 1,
    gap: 3,
  },
  restaurantTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  restaurantName: {
    ...typography.foodTitle,
    color: colors.textPrimary,
    fontWeight: "600",
    flex: 1,
  },
  openDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.statusDeliveredText,
    marginLeft: 6,
  },
  closedDot: {
    backgroundColor: colors.textSecondary,
  },
  restaurantAddress: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  restaurantMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaRatingText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  metaDistanceText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "500",
  },
  droneBadge: {
    backgroundColor: colors.badgeTintBg,
    borderRadius: radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  droneBadgeText: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: "600",
  },
  foodCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderHairline,
    gap: 12,
    alignItems: "center",
  },
  foodImage: {
    width: 68,
    height: 68,
    borderRadius: radius.sm,
  },
  foodImageFallback: {
    width: 68,
    height: 68,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  foodInfo: {
    flex: 1,
    gap: 3,
  },
  foodName: {
    ...typography.foodTitle,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  foodRestaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  foodRestaurantName: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  foodDescription: {
    ...typography.caption,
    color: colors.textMuted,
  },
  foodBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  foodPrice: {
    ...typography.price,
    color: colors.primary,
  },
  foodAddButton: {
    backgroundColor: colors.badgeTintBg,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  foodAddButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.75,
  },
});
