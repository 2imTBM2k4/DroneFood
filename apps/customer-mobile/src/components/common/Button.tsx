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
import { colors, motion, radius, shadows, spacing, typography } from "../../theme/tokens";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const isSolid = variant === "primary" || variant === "danger";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isSolid && shadows.glass,
        pressed && !disabled && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isSolid ? colors.textWhite : colors.primary} />
      ) : (
        <>
          {icon}
          <Text style={[styles.baseText, styles[`${variant}Text`], textStyle]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
  },
  baseText: {
    ...typography.subheadBold,
    textAlign: "center",
  },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  primaryText: { color: colors.textWhite },
  secondary: { backgroundColor: colors.glassFillStrong, borderColor: colors.glassBorder },
  secondaryText: { color: colors.primary },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  dangerText: { color: colors.textWhite },
  outline: { backgroundColor: colors.glassFill, borderColor: colors.border },
  outlineText: { color: colors.textPrimary },
  ghost: { backgroundColor: "transparent", borderColor: "transparent" },
  ghostText: { color: colors.primary },
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
  disabled: { opacity: 0.45 },
});
