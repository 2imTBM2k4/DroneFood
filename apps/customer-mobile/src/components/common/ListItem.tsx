import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import { Icon, type IconName } from "./Icon";

export interface ListItemProps {
  title: string;
  subtitle?: string;
  iconName?: IconName;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  destructive?: boolean;
  hasDivider?: boolean;
}

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  iconName,
  leftElement,
  rightElement,
  showChevron = true,
  onPress,
  style,
  titleStyle,
  subtitleStyle,
  destructive = false,
  hasDivider = false,
}) => {
  const content = (
    <View style={[styles.inner, hasDivider && styles.divider]}>
      {/* Left Item */}
      {leftElement ? (
        <View style={styles.leftWrapper}>{leftElement}</View>
      ) : iconName ? (
        <View
          style={[
            styles.iconBox,
            destructive && styles.iconBoxDestructive,
          ]}
        >
          <Icon
            name={iconName}
            size={18}
            color={destructive ? colors.danger : colors.textPrimary}
          />
        </View>
      ) : null}

      {/* Main Text Content */}
      <View style={styles.textContainer}>
        <Text
          style={[
            styles.title,
            destructive && styles.titleDestructive,
            titleStyle,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, subtitleStyle]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Right Element or Chevron */}
      {rightElement ? (
        <View style={styles.rightWrapper}>{rightElement}</View>
      ) : showChevron && onPress ? (
        <Icon name="chevron-right" size={16} color={colors.textMuted} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ""}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          pressed && styles.pressed,
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.container, style]}>{content}</View>;
};

const styles = StyleSheet.create({
  container: {
    minHeight: 52, // >= 44pt touch minimum
    justifyContent: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  leftWrapper: {
    marginRight: spacing.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  iconBoxDestructive: {
    backgroundColor: colors.statusCancelledBg,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  titleDestructive: {
    color: colors.danger,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rightWrapper: {
    marginLeft: spacing.sm,
    alignItems: "flex-end",
  },
  pressed: {
    opacity: motion.pressedOpacity,
    backgroundColor: colors.surfaceSubtle,
  },
});
