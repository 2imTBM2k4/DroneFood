import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { formatVnd } from "../../api/client";
import { Icon } from "../common/Icon";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import type { Food } from "../../types";

export interface FoodCardProps {
  food: Food;
  onSelect: (food: Food) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (foodId: string) => void;
  badgeLabel?: string;
  tags?: string[];
}

export const FoodCard: React.FC<FoodCardProps> = ({
  food,
  onSelect,
  isFavorite: initialFavorite = false,
  onToggleFavorite,
  badgeLabel,
  tags,
}) => {
  const [favorite, setFavorite] = useState(initialFavorite);

  const handleFavoritePress = () => {
    setFavorite((prev) => !prev);
    if (onToggleFavorite) {
      onToggleFavorite(food._id);
    }
  };

  // Micro-tags fallback if not provided
  const displayTags = tags || (food.category ? [food.category, "Nóng hổi"] : ["Đặc sản"]);
  const displayBadge = badgeLabel || (food.price > 45000 ? "Bán chạy 🔥" : undefined);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Món ${food.name}, giá ${formatVnd(food.price)}`}
      onPress={() => onSelect(food)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Top Image Container with Badges & Favorite Heart */}
      <View style={styles.imageContainer}>
        {food.image ? (
          <Image
            source={{ uri: food.image }}
            style={styles.image}
            resizeMode="cover"
            accessibilityLabel={`Hình ảnh món ${food.name}`}
          />
        ) : (
          <View style={styles.noImage}>
            <Icon name="utensils" size={32} color={colors.primary} />
          </View>
        )}

        {/* Top-Left Pill Badge */}
        {displayBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {displayBadge}
            </Text>
          </View>
        ) : null}

        {/* Top-Right Heart Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? "Bỏ yêu thích" : "Yêu thích món này"}
          hitSlop={8}
          onPress={handleFavoritePress}
          style={({ pressed }) => [styles.heartButton, pressed && styles.pressed]}
        >
          <Icon
            name="heart"
            size={18}
            color={favorite ? colors.heartActive : colors.heartInactive}
            variant={favorite ? "solid" : "outline"}
          />
        </Pressable>
      </View>

      {/* Card Content */}
      <View style={styles.body}>
        {/* Title & Micro Tags */}
        <View style={styles.titleWrap}>
          <Text numberOfLines={2} style={styles.title}>
            {food.name}
          </Text>
          <View style={styles.tagsRow}>
            {displayTags.slice(0, 2).map((tag, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 ? <Text style={styles.tagDot}>·</Text> : null}
                <Text style={styles.tagText} numberOfLines={1}>
                  {tag}
                </Text>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Price & Add to Cart Button */}
        <View style={styles.footer}>
          <Text style={styles.price}>{formatVnd(food.price)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Thêm ${food.name} vào giỏ`}
            onPress={() => onSelect(food)}
            style={({ pressed }) => [styles.addPillButton, pressed && styles.pressed]}
          >
            <Icon name="cart" size={14} color={colors.textWhite} />
            <Text style={styles.addPillText}>+ Thêm</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    maxWidth: "50%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.md,
    // Subtle elevation shadow
    shadowColor: "#003366",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1, // Square image ratio
    backgroundColor: colors.surfaceSubtle,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  noImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  badge: {
    position: "absolute",
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.badgeMintBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(0, 102, 204, 0.15)",
    maxWidth: "65%",
  },
  badgeText: {
    ...typography.micro,
    color: colors.badgeMintText,
    fontWeight: "700",
    fontSize: 10,
  },
  heartButton: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  body: {
    padding: spacing.sm,
    gap: spacing.xs,
    justifyContent: "space-between",
    flex: 1,
  },
  titleWrap: {
    gap: 3,
  },
  title: {
    ...typography.foodTitle,
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
    minHeight: 36, // Guarantees 2-line alignment
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "nowrap",
  },
  tagDot: {
    ...typography.micro,
    color: colors.textSecondary,
    fontSize: 10,
  },
  tagText: {
    ...typography.micro,
    color: colors.textSecondary,
    fontSize: 11,
  },
  footer: {
    marginTop: spacing.xxs,
    gap: spacing.xs,
  },
  price: {
    ...typography.price,
    fontSize: 15,
    color: colors.primary,
  },
  addPillButton: {
    minHeight: 44,
    height: 44,
    minWidth: 44,
    /* width: 44, height: 44 minimum touch target */
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  addPillText: {
    ...typography.caption,
    color: colors.textWhite,
    fontWeight: "700",
    fontSize: 13,
  },
});
