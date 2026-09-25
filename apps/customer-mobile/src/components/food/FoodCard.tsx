import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { formatVnd } from "../../api/client";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import type { Food } from "../../types";
import { GlassSurface } from "../common/GlassSurface";
import { Icon } from "../common/Icon";

interface FoodCardProps { food: Food; onSelect: (food: Food) => void; }

export const FoodCard: React.FC<FoodCardProps> = ({ food, onSelect }) => (
  <Pressable onPress={() => onSelect(food)} style={({ pressed }) => pressed && styles.pressed}>
    <GlassSurface tone="strong" contentStyle={styles.cardContent}>
      <View style={styles.body}>
        <View>
          <Text numberOfLines={2} style={styles.title}>{food.name}</Text>
          {food.description ? <Text numberOfLines={2} style={styles.description}>{food.description}</Text> : null}
        </View>
        <View style={styles.footer}>
          <Text style={styles.price}>{formatVnd(food.price)}</Text>
          <View style={styles.addButton}><Icon name="cart" size={16} color={colors.textWhite} /></View>
        </View>
      </View>
      {food.image ? <Image source={{ uri: food.image }} style={styles.image} resizeMode="cover" /> : <View style={styles.noImage}><Icon name="utensils" size={30} color={colors.textSecondary} /></View>}
    </GlassSurface>
  </Pressable>
);

const styles = StyleSheet.create({
  pressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
  cardContent: { minHeight: 132, padding: spacing.sm, flexDirection: "row", alignItems: "stretch", gap: spacing.md },
  body: { flex: 1, paddingVertical: spacing.xxs, justifyContent: "space-between", gap: spacing.sm },
  title: { ...typography.subheadBold, color: colors.textPrimary, lineHeight: 20 },
  description: { ...typography.caption, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  price: { ...typography.subheadBold, color: colors.primary },
  addButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  image: { width: 112, minHeight: 112, borderRadius: radius.lg, backgroundColor: colors.surfaceSubtle },
  noImage: { width: 112, minHeight: 112, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight },
});
