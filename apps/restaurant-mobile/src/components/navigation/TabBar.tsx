import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../theme/tokens";
import type { Tab } from "../../types";

interface TabBarProps {
  activeTab: Tab;
  onChangeTab: (tab: Tab) => void;
  pendingCount?: number;
}

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onChangeTab,
  pendingCount = 0,
}) => {
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Tổng quan", icon: "📊" },
    { key: "orders", label: "Đơn hàng", icon: "📋" },
    { key: "menu", label: "Thực đơn", icon: "🍽️" },
    { key: "wallet", label: "Ví quán", icon: "💰" },
    { key: "account", label: "Cài đặt", icon: "🏪" },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={styles.tabItem}
            onPress={() => onChangeTab(tab.key)}
          >
            <View style={styles.iconWrapper}>
              <Text style={styles.icon}>{tab.icon}</Text>
              {tab.key === "orders" && pendingCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {pendingCount > 99 ? "99+" : pendingCount}
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
    right: -12,
    backgroundColor: colors.danger,
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
    fontWeight: "800",
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
    width: 18,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary,
  },
});
