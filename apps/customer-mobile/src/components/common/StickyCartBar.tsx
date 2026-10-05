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

export interface StickyCartBarProps {
  itemCount: number;
  totalPriceText?: string;
  buttonLabel?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  subLabel?: string;
}

export const StickyCartBar: React.FC<StickyCartBarProps> = ({
  itemCount,
  totalPriceText,
  buttonLabel = "Xem giỏ hàng",
  onPress,
  style,
  subLabel = "Tổng số món",
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Left Item Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.subLabel}>{subLabel}</Text>
        <Text style={styles.countText}>
          {itemCount} {totalPriceText ? `· ${totalPriceText}` : "món"}
        </Text>
      </View>

      {/* Right Primary Action Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${buttonLabel}, ${itemCount} món`}
        onPress={onPress}
        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
      >
        <Text style={styles.actionText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
    width: "100%",
  },
  summaryContainer: {
    justifyContent: "center",
  },
  subLabel: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  countText: {
    ...typography.sectionTitle,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 1,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    minHeight: 44, // Touch target minimum
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textWhite,
  },
  pressed: {
    opacity: motion.pressedOpacity,
    transform: [{ scale: motion.pressedScale }],
  },
});
