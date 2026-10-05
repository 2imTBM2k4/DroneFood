import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import { Badge } from "./Badge";
import { FavoriteButton } from "./FavoriteButton";
import { formatVnd } from "../../api/client";
import { Icon } from "./Icon";

export interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image?: string;
  category?: string;
  description?: string;
  badgeLabel?: string;
  isFavorite?: boolean;
  onPress: () => void;
  onAddToCart?: () => void;
  onToggleFavorite?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  name,
  price,
  image,
  category,
  description,
  badgeLabel,
  isFavorite = false,
  onPress,
  onAddToCart,
  onToggleFavorite,
  style,
}) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Món ăn ${name}, giá ${formatVnd(price)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      {/* Top Image Container */}
      <View style={styles.imageContainer}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.image}
            resizeMode="cover"
            accessible={false}
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Icon name="pizza" size={36} color={colors.textMuted} />
          </View>
        )}

        {/* Optional Top Left Badge */}
        {badgeLabel ? (
          <View style={styles.badgeWrapper}>
            <Badge label={badgeLabel} variant="mint" />
          </View>
        ) : null}

        {/* Top Right Favorite Button */}
        {onToggleFavorite ? (
          <View style={styles.favoriteWrapper}>
            <FavoriteButton
              isFavorite={isFavorite}
              onToggle={onToggleFavorite}
              size={32}
            />
          </View>
        ) : null}
      </View>

      {/* Content Container */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.price}>{formatVnd(price)}</Text>

        {category || description ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {category || description}
          </Text>
        ) : null}

        {/* Add to Cart Pill Button */}
        {onAddToCart ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Thêm ${name} vào giỏ hàng`}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
            onPress={(e) => {
              e.stopPropagation();
              onAddToCart();
            }}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            <Text style={styles.addButtonText}>Thêm vào giỏ</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md, // 16px
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
    marginBottom: spacing.md,
    width: "48%", // Grid layout
  },
  imageContainer: {
    width: "100%",
    height: 140,
    backgroundColor: colors.surfaceSubtle, // #EFEFEF
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholderContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  badgeWrapper: {
    position: "absolute",
    top: spacing.xs,
    left: spacing.xs,
    zIndex: 2,
  },
  favoriteWrapper: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    zIndex: 2,
  },
  content: {
    padding: spacing.sm,
  },
  title: {
    ...typography.foodTitle,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 34,
  },
  price: {
    ...typography.price,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
  subtitle: {
    ...typography.micro,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  addButton: {
    marginTop: spacing.sm,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  addButtonText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.primary,
  },
  pressed: {
    opacity: motion.pressedOpacity,
  },
});
