import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "../common/Icon";
import { GlassSurface } from "../common/GlassSurface";
import { colors, motion, radius, spacing, typography } from "../../theme/tokens";
import type { ScreenName } from "../../types";

interface TabBarProps {
  currentTab: ScreenName;
  onTabChange: (tab: ScreenName) => void;
  cartCount?: number;
}

export const TabBar: React.FC<TabBarProps> = ({ currentTab, onTabChange, cartCount = 0 }) => {
  const tabs: { key: ScreenName; label: string; icon: IconName }[] = [
    { key: "home", label: "Khám phá", icon: "home" },
    { key: "orders", label: "Đơn hàng", icon: "orders" },
    { key: "cart", label: "Giỏ hàng", icon: "cart" },
    { key: "profile", label: "Cá nhân", icon: "profile" },
  ];

  return (
    <View style={styles.shell}>
      <GlassSurface radiusValue={radius.xl} intensity={70} tone="strong" style={styles.glass} contentStyle={styles.container}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.key ||
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
              style={({ pressed }) => [styles.tabItem, isActive && styles.tabItemActive, pressed && styles.pressed]}
              onPress={() => onTabChange(tab.key)}
            >
              <View style={styles.iconWrapper}>
                <Icon name={tab.icon} size={20} color={isActive ? colors.primary : colors.textSecondary} />
                {tab.key === "cart" && cartCount > 0 ? (
                  <View style={styles.badge}><Text style={styles.badgeText}>{cartCount > 99 ? "99+" : cartCount}</Text></View>
                ) : null}
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm, backgroundColor: "transparent" },
  glass: { width: "100%" },
  container: { minHeight: 66, flexDirection: "row", padding: spacing.xs, alignItems: "center" },
  tabItem: { flex: 1, minHeight: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: 3, position: "relative" },
  tabItemActive: { backgroundColor: colors.primaryLight },
  pressed: { opacity: motion.pressedOpacity, transform: [{ scale: motion.pressedScale }] },
  iconWrapper: { position: "relative" },
  badge: { position: "absolute", top: -6, right: -12, backgroundColor: colors.primary, borderRadius: radius.pill, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: colors.surfaceSolid },
  badgeText: { color: colors.textWhite, ...typography.micro },
  label: { ...typography.micro, color: colors.textSecondary },
  labelActive: { color: colors.primary },
});
