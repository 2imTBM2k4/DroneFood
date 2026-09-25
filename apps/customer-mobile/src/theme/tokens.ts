import { Platform } from "react-native";

export const colors = {
  bg: "#F8FAFC",
  canvas: "#F8FAFC",
  parchment: "#F3F8FF",
  surfaceCard: "rgba(255, 255, 255, 0.72)",
  surfaceSolid: "#FFFFFF",
  surfaceSubtle: "rgba(239, 246, 255, 0.82)",
  surfaceDark: "#172033",
  glassFill: "rgba(255, 255, 255, 0.66)",
  glassFillStrong: "rgba(255, 255, 255, 0.84)",
  glassBorder: "rgba(255, 255, 255, 0.88)",
  glassHighlight: "rgba(255, 255, 255, 0.96)",
  scrim: "rgba(15, 23, 42, 0.46)",

  primary: "#2563EB",
  primaryFocus: "#1D4ED8",
  primaryLight: "#EFF6FF",
  accent: "#2563EB",
  accentLight: "#EFF6FF",

  textPrimary: "#1E1E24",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  textWhite: "#FFFFFF",

  border: "rgba(226, 232, 240, 0.84)",
  borderHairline: "rgba(148, 163, 184, 0.22)",
  borderFocus: "#2563EB",
  shadowTint: "#1E40AF",

  statusPendingBg: "#FFF7E6",
  statusPendingText: "#9A5B12",
  statusPreparingBg: "#EFF6FF",
  statusPreparingText: "#1D4ED8",
  statusDeliveringBg: "#E8F2FF",
  statusDeliveringText: "#1D4ED8",
  statusDeliveredBg: "#EAF8EF",
  statusDeliveredText: "#167444",
  statusCancelledBg: "#FDECEC",
  statusCancelledText: "#B42318",

  droneBlue: "#2563EB",
  droneGreen: "#22A06B",
  droneOrange: "#C97A18",
  batteryHigh: "#16845B",
  batteryMed: "#A96412",
  batteryLow: "#B42318",
  success: "#167444",
  warning: "#9A5B12",
  danger: "#B42318",
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const radius = {
  xs: 10,
  sm: 14,
  md: 18,
  lg: 22,
  xl: 28,
  sheet: 30,
  pill: 9999,
};

const displayFamily = Platform.select({
  ios: "SF Pro Display",
  android: "sans-serif-medium",
  default: "Aptos Display",
});

const bodyFamily = Platform.select({
  ios: "SF Pro Text",
  android: "sans-serif",
  default: "Segoe UI",
});

const monoFamily = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "ui-monospace",
});

export const typography = {
  hero: { fontFamily: displayFamily, fontSize: 30, lineHeight: 34, fontWeight: "700" as const, letterSpacing: -0.8 },
  title1: { fontFamily: displayFamily, fontSize: 24, lineHeight: 29, fontWeight: "700" as const, letterSpacing: -0.55 },
  title2: { fontFamily: displayFamily, fontSize: 19, lineHeight: 24, fontWeight: "700" as const, letterSpacing: -0.3 },
  subhead: { fontFamily: bodyFamily, fontSize: 15, lineHeight: 20, fontWeight: "600" as const },
  subheadBold: { fontFamily: bodyFamily, fontSize: 15, lineHeight: 20, fontWeight: "700" as const },
  body: { fontFamily: bodyFamily, fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
  bodySecondary: { fontFamily: bodyFamily, fontSize: 13, lineHeight: 19, fontWeight: "400" as const },
  caption: { fontFamily: bodyFamily, fontSize: 12, lineHeight: 17, fontWeight: "500" as const },
  captionBold: { fontFamily: bodyFamily, fontSize: 12, lineHeight: 17, fontWeight: "700" as const },
  micro: { fontFamily: bodyFamily, fontSize: 10, lineHeight: 14, fontWeight: "700" as const, letterSpacing: 0.35 },
  mono: { fontFamily: monoFamily, fontSize: 12, lineHeight: 17, fontWeight: "600" as const },
};

export const shadows = {
  glass: {
    shadowColor: colors.shadowTint,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 4,
  },
  floating: {
    shadowColor: colors.shadowTint,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
    elevation: 8,
  },
};

export const motion = {
  pressedOpacity: 0.78,
  pressedScale: 0.985,
};
