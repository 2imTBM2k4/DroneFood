import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { colors, radius, shadows } from "../../theme/tokens";

type GlassTone = "default" | "soft" | "strong";

interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  radiusValue?: number;
  intensity?: number;
  tone?: GlassTone;
  elevated?: boolean;
}

const toneColor: Record<GlassTone, string> = {
  default: colors.glassFill,
  soft: colors.surfaceSubtle,
  strong: colors.glassFillStrong,
};

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  style,
  contentStyle,
  radiusValue = radius.lg,
  intensity = 58,
  tone = "default",
  elevated = true,
}) => (
  <View style={[elevated && shadows.glass, style]}>
    <View style={[styles.clip, { borderRadius: radiusValue }]}>
      <BlurView
        pointerEvents="none"
        tint="systemUltraThinMaterialLight"
        intensity={intensity}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.tint,
          { backgroundColor: toneColor[tone] },
        ]}
      />
      <View pointerEvents="box-none" style={contentStyle}>{children}</View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tint: {
    borderTopColor: colors.glassHighlight,
    borderTopWidth: 1,
  },
});
