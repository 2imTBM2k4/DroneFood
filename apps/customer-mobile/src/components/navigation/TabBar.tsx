import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "../common/Icon";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import type { ScreenName } from "../../types";

export interface TabBarProps {
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
          (tab.key === "home" && (currentTab === "restaurant" || currentTab === "search")) ||
          (tab.key === "cart" &&
            (currentTab === "cart-detail" || currentTab === "checkout")) ||
          (tab.key === "orders" && currentTab === "track") ||
          (tab.key === "profile" && currentTab === "address-book");

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              styles.tabItem,
              pressed && styles.pressed,
            ]}
            onPress={() => onTabChange(tab.key)}
          >
            {/* Active Pill Indicator for Home Tab like reference image */}
            <View
              style={[
                styles.iconContainer,
                isActive && styles.iconContainerActive,
              ]}
            >
              <Icon
                name={tab.icon}
                size={22}
                color={isActive ? colors.primary : colors.textSecondary}
                variant={isActive ? "solid" : "outline"}
              />
              {tab.key === "cart" && cartCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {cartCount > 99 ? "99+" : cartCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.label,
                isActive ? styles.labelActive : styles.labelInactive,
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const BottomTabBar = TabBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    minHeight: 58,
    paddingTop: 6,
    paddingBottom: 6,
    alignItems: "center",
  },
  tabItem: {
    flex: 1,
    minHeight: 44, // 44pt touch minimum
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    position: "relative",
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainerActive: {
    backgroundColor: colors.primaryLight, // Mint pill highlight behind active icon
  },
  badge: {
    position: "absolute",
    top: -4,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: {
    color: colors.textWhite,
    fontSize: 9,
    fontWeight: "700",
  },
  label: {
    ...typography.micro,
    fontSize: 11,
    marginTop: 2,
  },
  labelInactive: {
    color: colors.textSecondary,
    fontWeight: "500",
  },
  labelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  pressed: {
    opacity: motion.pressedOpacity,
  },
});
