import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import type { Food } from "../../types";

interface FoodCardProps {
  food: Food;
  onSelect: (food: Food) => void;
}

export const FoodCard: React.FC<FoodCardProps> = ({ food, onSelect }) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onSelect(food)}
    >
      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.title}>
          {food.name}
        </Text>
        {food.description ? (
          <Text numberOfLines={2} style={styles.description}>
            {food.description}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <Text style={styles.price}>{formatVnd(food.price)}</Text>
          <View style={styles.addButton}>
            <Text style={styles.addText}>+ Chọn món</Text>
          </View>
        </View>
      </View>
      {food.image ? (
        <Image source={{ uri: food.image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.noImage}>
          <Text style={styles.noImageText}>🍽️</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: "center",
  },
  cardPressed: {
    backgroundColor: colors.surfaceSubtle,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  description: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  price: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: "700",
  },
  addButton: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  addText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  noImage: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  noImageText: {
    fontSize: 32,
  },
});
