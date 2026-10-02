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

export interface TabOption<T extends string = string> {
  key: T;
  label: string;
  badge?: number | string;
}

export interface TabsProps<T extends string = string> {
  options: TabOption<T>[];
  activeKey: T;
  onSelectTab: (key: T) => void;
  style?: StyleProp<ViewStyle>;
  variant?: "pill" | "underline";
}

export const Tabs = <T extends string = string>({
  options,
  activeKey,
  onSelectTab,
  style,
  variant = "pill",
}: TabsProps<T>): React.ReactElement => {
  const isPill = variant === "pill";

  return (
    <View
      accessibilityRole="tablist"
      style={[
        isPill ? styles.pillContainer : styles.underlineContainer,
        style,
      ]}
    >
      {options.map((option) => {
        const isActive = activeKey === option.key;

        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelectTab(option.key)}
            style={({ pressed }) => [
              isPill ? styles.pillTab : styles.underlineTab,
              isActive && (isPill ? styles.pillTabActive : styles.underlineTabActive),
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                isActive ? styles.tabLabelActive : styles.tabLabelInactive,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
            {option.badge !== undefined ? (
              <View
                style={[
                  styles.badge,
                  isActive ? styles.badgeActive : styles.badgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isActive ? styles.badgeTextActive : styles.badgeTextInactive,
                  ]}
                >
                  {option.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSubtle, // #EFEFEF
    borderRadius: radius.pill,
    padding: 3,
    alignItems: "center",
  },
  underlineContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pillTab: {
    flex: 1,
    minHeight: 44, // 44pt touch minimum
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
  },
  pillTabActive: {
    backgroundColor: colors.surface,
  },
  underlineTab: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    paddingBottom: 8,
  },
  underlineTabActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 13,
  },
  tabLabelInactive: {
    color: colors.textSecondary,
    fontWeight: "500",
  },
  tabLabelActive: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  badge: {
    marginLeft: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeInactive: {
    backgroundColor: colors.border,
  },
  badgeActive: {
    backgroundColor: colors.primaryLight,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  badgeTextInactive: {
    color: colors.textSecondary,
  },
  badgeTextActive: {
    color: colors.primary,
  },
  pressed: {
    opacity: motion.pressedOpacity,
  },
});
