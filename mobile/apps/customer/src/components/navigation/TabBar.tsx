import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "../common/Icon";
import { colors, spacing, typography } from "../../theme/tokens";
import type { ScreenName } from "../../types";

interface TabBarProps {
  currentTab: ScreenName;
  onTabChange: (tab: ScreenName) => void;
  cartCount?: number;
}

export const TabBar: React.FC<TabBarProps> = ({
  currentTab,
  onTabChange,
  cartCount = 0,
}) => {
  const tabs: { key: ScreenName; label: string; icon: IconName }[] = [
    { key: "home", label: "Khám phá", icon: "home" },
    { key: "orders", label: "Đơn hàng", icon: "orders" },
    { key: "cart", label: "Giỏ hàng", icon: "cart" },
    { key: "profile", label: "Cá nhân", icon: "profile" },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive =
          currentTab === tab.key ||
          (tab.key === "home" && currentTab === "restaurant") ||
          (tab.key === "cart" && currentTab === "checkout") ||
          (tab.key === "orders" && currentTab === "track") ||
          (tab.key === "profile" && currentTab === "address-book");

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            style={styles.tabItem}
            onPress={() => onTabChange(tab.key)}
          >
            <View style={styles.iconWrapper}>
              <Icon name={tab.icon} size={21} color={isActive ? colors.primary : colors.textSecondary} />
              {tab.key === "cart" && cartCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {cartCount > 99 ? "99+" : cartCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
            {isActive ? <View style={styles.activeIndicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    paddingBottom: spacing.xs,
    paddingTop: spacing.xs,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    position: "relative",
  },
  iconWrapper: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: colors.accent,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  label: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  activeIndicator: {
    position: "absolute",
    bottom: -6,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary,
  },
});
