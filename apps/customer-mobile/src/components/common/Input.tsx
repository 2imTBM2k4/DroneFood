import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  containerStyle,
  leftIcon,
  rightIcon,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        pointerEvents="box-none"
        style={[
          styles.inputWrapper,
          isFocused && styles.focused,
          Boolean(error) && styles.errorBorder,
          rest.multiline && styles.multilineWrapper,
        ]}
      >
        {leftIcon ? <View pointerEvents="none" style={styles.leftIcon}>{leftIcon}</View> : null}
        <TextInput
          style={[styles.input, rest.multiline && styles.multilineInput, style]}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />
        {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: spacing.xxs },
  label: { ...typography.captionBold, color: colors.textPrimary, marginLeft: spacing.xs },
  inputWrapper: {
    minHeight: 52,
    backgroundColor: colors.glassFillStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  focused: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSolid,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  errorBorder: { borderColor: colors.danger },
  multilineWrapper: { minHeight: 96, alignItems: "flex-start", paddingVertical: spacing.sm },
  input: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: 0 },
  multilineInput: { textAlignVertical: "top", minHeight: 72 },
  leftIcon: { marginRight: spacing.xs, justifyContent: "center", alignItems: "center" },
  rightIcon: { marginLeft: spacing.xs, justifyContent: "center", alignItems: "center" },
  errorText: { ...typography.caption, color: colors.danger, marginLeft: spacing.xs },
  hintText: { ...typography.caption, color: colors.textSecondary, marginLeft: spacing.xs },
});
