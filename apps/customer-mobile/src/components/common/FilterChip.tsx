import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import { Icon, type IconName } from "./Icon";

export interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  selected = false,
  onPress,
  leadingIcon,
  trailingIcon,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected }}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
        pressed && styles.pressed,
        style,
      ]}
    >
      {leadingIcon ? (
        <Icon
          name={leadingIcon}
          size={14}
          color={selected ? colors.textWhite : colors.textPrimary}
          variant={selected ? "solid" : "outline"}
        />
      ) : null}
      <Text
        style={[
          styles.label,
          selected ? styles.labelSelected : styles.labelUnselected,
          leadingIcon ? styles.labelWithLeading : null,
          trailingIcon ? styles.labelWithTrailing : null,
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {trailingIcon ? (
        <Icon
          name={trailingIcon}
          size={14}
          color={selected ? colors.textWhite : colors.textPrimary}
          variant={selected ? "solid" : "outline"}
        />
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    height: 38,
    paddingHorizontal: spacing.md,
    marginRight: spacing.xs,
  },
  chipUnselected: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  label: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: "500",
  },
  labelUnselected: {
    color: colors.textPrimary,
  },
  labelSelected: {
    color: colors.textWhite,
    fontWeight: "600",
  },
  labelWithLeading: {
    marginLeft: spacing.xxs,
  },
  labelWithTrailing: {
    marginRight: spacing.xxs,
  },
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
});
