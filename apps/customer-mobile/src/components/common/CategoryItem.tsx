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
import { Icon, type IconName } from "./Icon";

export interface CategoryItemProps {
  label: string;
  iconName?: IconName;
  imageUri?: string;
  selected?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  size?: number;
}

export const CategoryItem: React.FC<CategoryItemProps> = ({
  label,
  iconName,
  imageUri,
  selected = false,
  onPress,
  style,
  size = 64,
}) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Danh mục ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed, style]}
    >
      <View
        style={[
          styles.iconBox,
          { width: size, height: size },
          selected && styles.iconBoxSelected,
        ]}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={[styles.image, { width: size - 16, height: size - 16 }]}
            resizeMode="contain"
            accessible={false}
          />
        ) : iconName ? (
          <Icon
            name={iconName}
            size={size * 0.45}
            color={selected ? colors.primary : colors.textPrimary}
            variant={selected ? "solid" : "outline"}
          />
        ) : null}
      </View>
      <Text
        style={[styles.label, selected && styles.labelSelected]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginRight: spacing.md,
    width: 68,
  },
  iconBox: {
    backgroundColor: colors.surfaceSubtle, // Subtle pale gray #EFEFEF
    borderRadius: radius.md, // 16px rounded square
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  iconBoxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight, // #E8F6F1
  },
  image: {
    borderRadius: radius.sm,
  },
  label: {
    marginTop: spacing.xs,
    ...typography.caption,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: "center",
    fontWeight: "500",
  },
  labelSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
});
