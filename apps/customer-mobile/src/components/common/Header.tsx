import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import { Icon } from "./Icon";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onBack, rightAction }) => (
  <View style={styles.container}>
    <View style={styles.left}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={onBack}
        >
          <View style={styles.backGlyph}>
            <Icon name="chevron-right" size={20} color={colors.textPrimary} />
          </View>
        </Pressable>
      ) : null}
      <View style={styles.titleContainer}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
    {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
  },
  left: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.glassFillStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  backGlyph: { transform: [{ rotate: "180deg" }] },
  pressed: { opacity: motion.pressedOpacity, transform: [{ scale: motion.pressedScale }] },
  titleContainer: { flex: 1 },
  title: { ...typography.title2, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  right: { marginLeft: spacing.sm },
});
