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

export interface StepperProps {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
  max?: number;
  style?: StyleProp<ViewStyle>;
  size?: "sm" | "md";
}

export const Stepper: React.FC<StepperProps> = ({
  value,
  onIncrement,
  onDecrement,
  min = 1,
  max = 99,
  style,
  size = "md",
}) => {
  const canDecrement = value > min;
  const canIncrement = value < max;
  const isSm = size === "sm";

  return (
    <View style={[styles.container, isSm && styles.containerSm, style]}>
      {/* Decrement Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Giảm số lượng"
        accessibilityState={{ disabled: !canDecrement }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        disabled={!canDecrement}
        onPress={onDecrement}
        style={({ pressed }) => [
          styles.button,
          isSm && styles.buttonSm,
          !canDecrement && styles.buttonDisabled,
          pressed && canDecrement && styles.pressed,
        ]}
      >
        <Text style={[styles.buttonText, isSm && styles.buttonTextSm]}>−</Text>
      </Pressable>

      {/* Value Display */}
      <View style={[styles.valueBox, isSm && styles.valueBoxSm]}>
        <Text
          accessibilityRole="text"
          accessibilityLabel={`Số lượng: ${value}`}
          style={[styles.valueText, isSm && styles.valueTextSm]}
        >
          {value}
        </Text>
      </View>

      {/* Increment Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tăng số lượng"
        accessibilityState={{ disabled: !canIncrement }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        disabled={!canIncrement}
        onPress={onIncrement}
        style={({ pressed }) => [
          styles.button,
          isSm && styles.buttonSm,
          !canIncrement && styles.buttonDisabled,
          pressed && canIncrement && styles.pressed,
        ]}
      >
        <Text style={[styles.buttonText, isSm && styles.buttonTextSm]}>+</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
    alignSelf: "flex-start",
  },
  containerSm: {
    padding: 1,
  },
  button: {
    width: 44, // Touch target minimum 44pt
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonSm: {
    width: 36,
    height: 32,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  buttonTextSm: {
    fontSize: 15,
  },
  valueBox: {
    minWidth: 32,
    paddingHorizontal: spacing.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  valueBoxSm: {
    minWidth: 26,
    paddingHorizontal: spacing.xxs,
  },
  valueText: {
    ...typography.price,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  valueTextSm: {
    fontSize: 13,
  },
  pressed: {
    opacity: motion.pressedOpacity,
  },
});
