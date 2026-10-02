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

export interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backAccessibilityLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
  style,
  backAccessibilityLabel = "Quay lại",
}) => (
  <View style={[styles.container, style]}>
    <View style={styles.left}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={onBack}
        >
          <Icon name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
      ) : null}
      <View style={styles.titleContainer}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={styles.title}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
    {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
  </View>
);

export const ScreenHeader = Header;

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "flex-start",
    justifyContent: "center",
    marginRight: spacing.xxs,
  },
  titleContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    ...typography.screenTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  pressed: {
    opacity: motion.pressedOpacity,
  },
});
