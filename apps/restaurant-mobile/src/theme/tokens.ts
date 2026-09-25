export const colors = {
  // Brand & Action
  primary: "#EA580C",          // Flame Orange
  primaryHover: "#C2410C",
  primaryLight: "#FFEDD5",
  primaryDark: "#9A3412",
  
  navy: "#0F172A",
  navyLight: "#1E293B",
  
  // Surfaces & Backgrounds
  canvas: "#FFFFFF",
  parchment: "#F8FAFC",
  surfaceCard: "#FFFFFF",
  surfaceSubtle: "#F1F5F9",
  surfaceDark: "#1E293B",
  
  // Text & Ink
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  textWhite: "#FFFFFF",
  
  // Borders & Dividers
  border: "#E2E8F0",
  borderHairline: "rgba(0, 0, 0, 0.08)",
  borderFocus: "#EA580C",
  
  // Kitchen Order Status
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

  // Success & Danger
  success: "#10B981",
  successLight: "#ECFDF5",
  danger: "#EF4444",
  dangerLight: "#FEF2F2",
  warning: "#F59E0B",
  warningLight: "#FFFBEB",
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
  lg: 16,
  xl: 22,
  pill: 9999,
};

export const typography = {
  hero: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.4 },
  title1: { fontSize: 21, fontWeight: "700" as const, letterSpacing: -0.3 },
  title2: { fontSize: 18, fontWeight: "600" as const },
  subhead: { fontSize: 15, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodySecondary: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "500" as const },
  captionBold: { fontSize: 12, fontWeight: "700" as const },
  micro: { fontSize: 10, fontWeight: "600" as const },
};
