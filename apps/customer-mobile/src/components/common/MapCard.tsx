import React from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "../../theme/tokens";

export interface MapCardProps {
  children: React.ReactNode;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export const MapCard: React.FC<MapCardProps> = ({
  children,
  height = 240,
  style,
}) => {
  return (
    <View style={[styles.container, { height }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: radius.lg, // 20px bo góc
    overflow: "hidden",
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
  },
});
