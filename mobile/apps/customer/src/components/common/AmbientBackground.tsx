import React from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { colors } from "../../theme/tokens";

const { width, height } = Dimensions.get("window");

export const AmbientBackground: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <View style={styles.container}>
      {/* Soft cool ambient blue halo (Rule 1: Lớp nền sáng lạnh, chỉ dùng một quầng xanh mềm) */}
      <View style={styles.fill} pointerEvents="none">
        <Svg width={width} height={height} style={styles.fill}>
          <Defs>
            <RadialGradient
              id="ambientHalo"
              cx="50%"
              cy="15%"
              rx="60%"
              ry="45%"
              fx="50%"
              fy="15%"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor="#2563EB" stopOpacity="0.08" />
              <Stop offset="50%" stopColor="#2563EB" stopOpacity="0.03" />
              <Stop offset="100%" stopColor="#F8FAFC" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={height} fill="url(#ambientHalo)" />
        </Svg>
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
});
