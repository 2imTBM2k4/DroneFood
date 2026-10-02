import React from "react";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, motion, radius } from "../../theme/tokens";
import { Icon } from "./Icon";

export interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  isFavorite,
  onToggle,
  size = 36,
  style,
  accessibilityLabel,
}) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ||
        (isFavorite ? "Bỏ yêu thích" : "Thêm vào mục yêu thích")
      }
      accessibilityState={{ selected: isFavorite }}
      hitSlop={8}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.container,
        { width: size, height: size },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Icon
        name="heart"
        size={size * 0.55}
        color={isFavorite ? colors.heartActive : colors.heartInactive}
        variant={isFavorite ? "solid" : "outline"}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: 0.92 }],
  },
});
