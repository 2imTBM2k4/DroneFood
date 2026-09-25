import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { colors } from "../../theme/tokens";

export const AmbientBackground: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="ambientHalo" cx="18%" cy="4%" rx="82%" ry="52%">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.18" />
              <Stop offset="48%" stopColor={colors.primary} stopOpacity="0.055" />
              <Stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
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
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
