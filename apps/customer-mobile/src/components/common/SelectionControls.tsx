import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import { Icon } from "./Icon";

// ============================================================================
// CHECKBOX
// ============================================================================

export interface CheckboxProps {
  checked: boolean;
  onToggle: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onToggle,
  label,
  disabled = false,
  style,
  accessibilityLabel,
}) => {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onToggle(!checked)}
      style={({ pressed }) => [
        styles.rowContainer,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <View
        style={[
          styles.checkboxBox,
          checked ? styles.checkboxChecked : styles.checkboxUnchecked,
        ]}
      >
        {checked ? (
          <Icon name="check" size={14} color={colors.textWhite} strokeWidth={2.5} />
        ) : null}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
};

// ============================================================================
// RADIO
// ============================================================================

export interface RadioProps {
  selected: boolean;
  onSelect: () => void;
  label?: string;
  subLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const Radio: React.FC<RadioProps> = ({
  selected,
  onSelect,
  label,
  subLabel,
  disabled = false,
  style,
  accessibilityLabel,
}) => {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.rowContainer,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <View
        style={[
          styles.radioOuter,
          selected ? styles.radioOuterSelected : styles.radioOuterUnselected,
        ]}
      >
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
      {label || subLabel ? (
        <View style={styles.labelColumn}>
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {subLabel ? <Text style={styles.subLabel}>{subLabel}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
};

// ============================================================================
// SWITCH
// ============================================================================

export interface SwitchProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const Switch: React.FC<SwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel = "Công tắc chuyển đổi",
  style,
}) => {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.switchTrack,
        value ? styles.switchTrackActive : styles.switchTrackInactive,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <View
        style={[
          styles.switchThumb,
          value ? styles.switchThumbActive : styles.switchThumbInactive,
        ]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44, // Touch target minimum
    minWidth: 44,
    paddingVertical: spacing.xs,
  },
  labelColumn: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  subLabel: {
    ...typography.micro,
    color: colors.textSecondary,
    marginTop: 2,
    marginLeft: spacing.sm,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: motion.pressedOpacity,
  },
  // Checkbox box
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxUnchecked: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  // Radio
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterUnselected: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  radioOuterSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  // Switch
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: radius.pill,
    padding: 2,
    justifyContent: "center",
  },
  switchTrackActive: {
    backgroundColor: colors.primary,
  },
  switchTrackInactive: {
    backgroundColor: colors.border,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  switchThumbActive: {
    alignSelf: "flex-end",
  },
  switchThumbInactive: {
    alignSelf: "flex-start",
  },
});
