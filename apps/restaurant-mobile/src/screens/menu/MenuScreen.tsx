import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Button } from "../../components/common/Button";
import { FoodEditorModal } from "../../components/food/FoodEditorModal";
import type { DraftFood, Food } from "../../types";

interface MenuScreenProps {
  foods: Food[];
  loading: boolean;
  working: boolean;
  onRefresh: () => void;
  onSaveFood: (draft: DraftFood) => Promise<void>;
  onRemoveFood: (food: Food) => void;
}

const emptyDraft = (): DraftFood => ({
  name: "",
  description: "",
  price: "",
  category: "Món chính",
  image: null,
  optionGroups: [],
});

export const MenuScreen: React.FC<MenuScreenProps> = ({
  foods,
  loading,
  working,
  onRefresh,
  onSaveFood,
  onRemoveFood,
}) => {
  const [selectedCat, setSelectedCat] = useState("all");
  const [editingDraft, setEditingDraft] = useState<DraftFood | null>(null);

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

  const handleEdit = (food: Food) => {
    setEditingDraft({
      id: food._id,
      name: food.name,
      description: food.description,
      price: String(food.price),
      category: food.category,
      existingImage: food.image,
      optionGroups: food.optionGroups || [],
    });
  };

  const handleSave = async () => {
    if (!editingDraft) return;
    const priceNum = Number(editingDraft.price);
    if (
      !editingDraft.name.trim() ||
      !editingDraft.description.trim() ||
      !editingDraft.category.trim() ||
      !Number.isInteger(priceNum) ||
      priceNum <= 0
    ) {
      Alert.alert(
        "Thông tin chưa hợp lệ",
        "Vui lòng điền tên, mô tả, danh mục và giá bán nguyên dương."
      );
      return;
    }
    if (!editingDraft.id && !editingDraft.image) {
      Alert.alert("Thiếu ảnh món", "Món ăn mới cần có 1 ảnh đại diện để hiển thị cho khách.");
      return;
    }

    await onSaveFood(editingDraft);
    setEditingDraft(null);
  };

  return (
    <View style={styles.container}>
      {/* Top Header Row with Add Food Button */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Quản lý thực đơn</Text>
          <Text style={styles.subtitle}>{foods.length} món ăn đang phục vụ</Text>
        </View>
        <Button
          label="+ Thêm món mới"
          variant="primary"
          style={styles.addBtn}
          onPress={() => setEditingDraft(emptyDraft())}
        />
      </View>

      {/* Category Horizontal Filter */}
      {categories.length > 1 ? (
        <View style={styles.categoryWrap}>
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
                      styles.catText,
                      isSelected && styles.catTextSelected,
                    ]}
                  >
                    {cat === "all" ? "Tất cả" : cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        data={filteredFoods}
        keyExtractor={(item) => item._id}
        onRefresh={onRefresh}
        refreshing={loading}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>
              {loading ? "Đang tải thực đơn..." : "Chưa có món nào trong thực đơn"}
            </Text>
            <Text style={styles.emptySub}>
              Bấm "+ Thêm món mới" ở góc trên để tạo món ăn đầu tiên cho quán.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.foodCard}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.foodImage} />
            ) : (
              <View style={styles.noImage}>
                <Text style={styles.noImageIcon}>🍽️</Text>
              </View>
            )}

            <View style={styles.foodBody}>
              <View style={styles.foodHeader}>
                <Text numberOfLines={1} style={styles.foodName}>
                  {item.name}
                </Text>
                <Text style={styles.categoryBadge}>{item.category}</Text>
              </View>

              <Text numberOfLines={2} style={styles.foodDesc}>
                {item.description}
              </Text>

              <Text style={styles.foodPrice}>{formatVnd(item.price)}</Text>

              {item.optionGroups && item.optionGroups.length > 0 ? (
                <Text style={styles.optionsCount}>
                  ⚙️ {item.optionGroups.length} nhóm tùy chọn (
                  {item.optionGroups.map((g) => g.name).join(", ")})
                </Text>
              ) : null}

              <View style={styles.actionsRow}>
                <Button
                  label="Chỉnh sửa & Topping"
                  variant="secondary"
                  disabled={working}
                  style={styles.actionBtn}
                  onPress={() => handleEdit(item)}
                />
                <Button
                  label="Xóa"
                  variant="outline"
                  disabled={working}
                  style={styles.actionBtnSmall}
                  onPress={() => onRemoveFood(item)}
                />
              </View>
            </View>
          </View>
        )}
      />

      {/* Food Editor Modal */}
      <FoodEditorModal
        draft={editingDraft}
        working={working}
        onClose={() => setEditingDraft(null)}
        onChange={setEditingDraft}
        onSave={handleSave}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  headerRow: {
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  addBtn: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  categoryWrap: {
    backgroundColor: colors.canvas,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  categoryScroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  catPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  catTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 100,
  },
  foodCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  foodImage: {
    width: 104,
    height: "100%",
    minHeight: 120,
    backgroundColor: colors.surfaceSubtle,
  },
  noImage: {
    width: 104,
    height: "100%",
    minHeight: 120,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  noImageIcon: {
    fontSize: 32,
  },
  foodBody: {
    flex: 1,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  foodHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  foodName: {
    ...typography.subhead,
    color: colors.textPrimary,
    flex: 1,
  },
  categoryBadge: {
    ...typography.micro,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
    color: colors.textSecondary,
  },
  foodDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  foodPrice: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: "700",
    marginTop: 2,
  },
  optionsCount: {
    ...typography.micro,
    color: colors.primaryDark,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  actionBtnSmall: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.xs,
  },
  emptyIcon: {
    fontSize: 54,
  },
  emptyTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptySub: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
