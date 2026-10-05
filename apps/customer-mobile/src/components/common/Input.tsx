import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Icon } from "./Icon";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  isPassword?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputWrapperStyle?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  isPassword = false,
  containerStyle,
  inputWrapperStyle,
  leftIcon,
  rightIcon,
  style,
  secureTextEntry,
  ...rest
}) => {
  const [hidePassword, setHidePassword] = useState(isPassword);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View
        pointerEvents="box-none"
        style={[
          styles.inputWrapper,
          inputWrapperStyle,
          Boolean(error) && styles.errorBorder,
          rest.multiline && styles.multilineWrapper,
        ]}
      >
        {leftIcon ? (
          <View pointerEvents="none" style={styles.leftIcon}>
            {leftIcon}
          </View>
        ) : null}
        <TextInput
          style={[
            styles.input,
            rest.multiline && styles.multilineInput,
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          secureTextEntry={isPassword ? hidePassword : secureTextEntry}
          accessibilityLabel={rest.accessibilityLabel || label}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidePassword ? "Hiện mật khẩu" : "Ẩn mật khẩu"}
            accessibilityState={{ selected: !hidePassword }}
            hitSlop={10}
            onPress={() => setHidePassword((prev) => !prev)}
            style={styles.rightIcon}
          >
            <Icon
              name="settings"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : rightIcon ? (
          <View style={styles.rightIcon}>{rightIcon}</View>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
      {!error && hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
  },
  label: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  inputWrapper: {
    minHeight: 48,
    borderRadius: radius.pill, // Modern pill shape
    backgroundColor: colors.surfaceSubtle, // #EFEFEF
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  multilineWrapper: {
    minHeight: 96,
    borderRadius: radius.md,
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
  },
  errorBorder: {
    borderColor: colors.danger,
    backgroundColor: colors.statusCancelledBg,
  },
  input: {
    flex: 1,
    alignSelf: "stretch",
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  multilineInput: {
    textAlignVertical: "top",
    paddingTop: 0,
  },
  leftIcon: {
    marginRight: spacing.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  rightIcon: {
    minWidth: 48,
    minHeight: 48,
    marginLeft: spacing.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    fontSize: 12,
    marginTop: 2,
  },
  hintText: {
    ...typography.micro,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
