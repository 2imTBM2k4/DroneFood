import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "danger" | "outline" | "ghost" | "glass";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  accessibilityLabel,
  fullWidth = false,
}) => {
  const isSolid = variant === "primary" || variant === "danger";
  const isGlass = variant === "glass";

  const getSpinnerColor = () => {
    if (isSolid || isGlass) return colors.textWhite;
    return colors.primary;
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      hitSlop={size === "sm" ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        pressed && !disabled && !loading && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getSpinnerColor()} />
      ) : (
        <>
          {icon ? <>{icon}</> : null}
          <Text
            style={[
              styles.baseText,
              styles[`${variant}Text`],
              styles[`${size}Text`],
              icon ? styles.textWithIcon : null,
              textStyle,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: 44, // WCAG AA Touch Target Minimum
  },
  fullWidth: {
    width: "100%",
  },
  // Sizes
  sm: {
    minHeight: 40,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  md: {
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  lg: {
    minHeight: 54,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  // Variants
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  glass: {
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: colors.danger,
  },
  // States
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
  disabled: {
    opacity: 0.45,
  },
  // Typography per variant
  baseText: {
    ...typography.body,
    fontWeight: "600",
    textAlign: "center",
  },
  smText: {
    fontSize: 13,
    lineHeight: 18,
  },
  mdText: {
    fontSize: 14,
    lineHeight: 20,
  },
  lgText: {
    fontSize: 15,
    lineHeight: 22,
  },
  primaryText: {
    color: colors.textWhite,
  },
  secondaryText: {
    color: colors.textPrimary,
  },
  glassText: {
    color: colors.glassText,
  },
  outlineText: {
    color: colors.primary,
  },
  ghostText: {
    color: colors.primary,
  },
  dangerText: {
    color: colors.textWhite,
  },
  textWithIcon: {
    marginLeft: spacing.xs,
  },
});
