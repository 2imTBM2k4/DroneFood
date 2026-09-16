import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  const tabs: { key: ScreenName; label: string; icon: string }[] = [
    { key: "home", label: "Khám phá", icon: "🏠" },
    { key: "orders", label: "Đơn hàng", icon: "📋" },
    { key: "cart", label: "Giỏ hàng", icon: "🛒" },
    { key: "profile", label: "Cá nhân", icon: "👤" },
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
            accessibilityState={{ selected: isActive }}
            style={styles.tabItem}
            onPress={() => onTabChange(tab.key)}
          >
            <View style={styles.iconWrapper}>
              <Text style={styles.icon}>{tab.icon}</Text>
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
  icon: {
    fontSize: 20,
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
