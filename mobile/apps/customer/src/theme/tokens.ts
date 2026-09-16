export const colors = {
  // Brand & Interactive
  primary: "#0066CC",          // Apple Action Blue
  primaryFocus: "#0071E3",
  primaryLight: "#EBF5FF",
  accent: "#FF4B3A",           // Culinary Vibrant Coral
  accentLight: "#FFF1F0",
  
  // Surfaces & Backgrounds
  canvas: "#FFFFFF",
  parchment: "#F8F9FA",
  surfaceCard: "#FFFFFF",
  surfaceSubtle: "#F1F5F9",
  surfaceDark: "#1D1D1F",
  
  // Text & Ink
  textPrimary: "#1D1D1F",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  textWhite: "#FFFFFF",
  
  // Borders & Dividers
  border: "#E2E8F0",
  borderHairline: "rgba(0, 0, 0, 0.08)",
  borderFocus: "#0066CC",
  
  // Status Colors
  statusPendingBg: "#FEF3C7",
  statusPendingText: "#B45309",
  statusPreparingBg: "#DBEAFE",
  statusPreparingText: "#1D4ED8",
  statusDeliveringBg: "#EDE9FE",
  statusDeliveringText: "#6D28D9",
  statusDeliveredBg: "#DCFCE7",
  statusDeliveredText: "#15803D",
  statusCancelledBg: "#FEE2E2",
  statusCancelledText: "#B91C1C",

  // Telemetry & Tech
  droneBlue: "#0284C7",
  droneGreen: "#10B981",
  droneOrange: "#F59E0B",
  batteryHigh: "#10B981",
  batteryMed: "#F59E0B",
  batteryLow: "#EF4444",
  success: "#15803D",
  danger: "#DC2626",
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 9999,
};

export const typography = {
  hero: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
  title1: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.4 },
  title2: { fontSize: 18, fontWeight: "600" as const, letterSpacing: -0.3 },
  subhead: { fontSize: 15, fontWeight: "600" as const },
  subheadBold: { fontSize: 15, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodySecondary: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "500" as const },
  captionBold: { fontSize: 12, fontWeight: "700" as const },
  micro: { fontSize: 10, fontWeight: "600" as const },
};
