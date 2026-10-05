/**
 * DroneFood Customer Mobile Design System Tokens
 * 
 * Architecture: 3-Layer Design Token Hierarchy
 * Layer 1: Primitive Tokens (Raw Palette & Measurements)
 * Layer 2: Semantic Tokens (Design Purpose Aliases)
 * Layer 3: Component Tokens (Component-Specific Styling)
 * 
 * Visual Style: Flat, Clean, Modern Teal Theme, System Fonts, Pill Geometry.
 */

// ============================================================================
// LAYER 1: PRIMITIVE TOKENS
// ============================================================================

export const primitives = {
  colors: {
    // Action Blue Brand Palette (Synchronized with Web & brand-spec)
    blue700: "#0055AA",
    blue600: "#0066CC", // Primary Action Blue
    blue500: "#0071E3", // Focus Blue
    blue400: "#2997FF", // Sky Link Blue on Dark
    blue50: "#EBF3FB",  // 8% Tint Light Background

    // Neutral & Blue-Tinted Palette
    white: "#FFFFFF",
    blueCanvas: "#F4F8FD",       // Sky-tinted Fresh Canvas (previously gray50)
    blueSubtle: "#EAF2FC",       // Subtle Blue Surface: Search Input, Category Boxes (previously gray100)
    blueBorder: "#DCEAF8",       // Soft Blue Card Border (previously gray200)
    blueBorderSubtle: "#E6EFF9", // Hairline Card Border
    gray50: "#F4F8FD",           // Mapped to blueCanvas for smooth transition
    gray100: "#EAF2FC",          // Mapped to blueSubtle
    gray200: "#DCEAF8",          // Mapped to blueBorder
    gray300: "#CADDF2",
    gray400: "#9BB7D8",
    gray500: "#737373",
    gray600: "#666666",          // Unified Secondary Text & Placeholder (WCAG AA >= 4.5:1)
    gray800: "#262626",
    gray900: "#1A1A1A",          // Primary Dark Text

    // Semantic Accents
    red500: "#EF4444",
    red600: "#DC2626",
    red800: "#991B1B",
    red50: "#FEE2E2",

    amber500: "#F59E0B",
    amber800: "#92400E",
    amber50: "#FEF3C7",

    purple800: "#5B21B6",
    purple50: "#EDE9FE",

    sky800: "#075985",
    sky50: "#E0F2FE",

    emerald800: "#166534",
    emerald50: "#DCFCE7",

    // Deprecated Teal references (retained for backward compatibility)
    teal600: "#0066CC",
    teal100: "#EBF3FB",
  },
} as const;

// ============================================================================
// LAYER 2 & 3: SEMANTIC & COMPONENT TOKENS
// ============================================================================

export const colors = {
  // Brand & Accent (Action Blue)
  primary: primitives.colors.blue600,
  primaryFocus: primitives.colors.blue500,
  primaryOnDark: primitives.colors.blue400,
  primaryLight: primitives.colors.blue50,
  accent: primitives.colors.blue600,
  accentLight: primitives.colors.blue50,

  // Canvas & Surfaces (Airy Blue)
  bg: primitives.colors.blueCanvas,
  canvas: primitives.colors.blueCanvas,
  surface: primitives.colors.white,
  surfaceSolid: primitives.colors.white,
  surfaceCard: primitives.colors.white,
  surfaceSubtle: primitives.colors.blueSubtle,
  surfaceDark: primitives.colors.gray900,
  card: primitives.colors.white,

  // Text Roles
  textPrimary: primitives.colors.gray900,
  textSecondary: primitives.colors.gray600, // #666666 (WCAG AA >= 4.5:1)
  textMuted: primitives.colors.gray600,     // #666666 (Placeholder shares same token)
  textWhite: primitives.colors.white,
  textInverse: primitives.colors.white,

  // Borders
  border: primitives.colors.blueBorder,
  borderHairline: primitives.colors.blueBorderSubtle,
  borderFocus: primitives.colors.blue600,
  borderSubtle: primitives.colors.blueBorderSubtle,

  // Heart / Favorite Icon
  heartActive: primitives.colors.red500,
  heartInactive: primitives.colors.gray900,

  // Badges & Micro-tags (#EBF3FB bg, #0066CC text)
  badgeMintBg: primitives.colors.blue50,
  badgeMintText: primitives.colors.blue600,
  badgeTintBg: primitives.colors.blue50,
  badgeTintText: primitives.colors.blue600,

  // Glass Button Variant (e.g., "Editor's Pick" on Banner)
  glassBg: "rgba(255, 255, 255, 0.22)",
  glassBgStrong: "rgba(255, 255, 255, 0.85)",
  glassBorder: "rgba(255, 255, 255, 0.35)",
  glassHighlight: "rgba(255, 255, 255, 0.65)",
  glassText: primitives.colors.white,
  scrim: "rgba(0, 0, 0, 0.45)",

  // Order Status Colors (WCAG AA compliant contrast > 4.5:1)
  statusPendingBg: primitives.colors.amber50,
  statusPendingText: primitives.colors.amber800,
  statusPreparingBg: primitives.colors.purple50,
  statusPreparingText: primitives.colors.purple800,
  statusDeliveringBg: primitives.colors.sky50,
  statusDeliveringText: primitives.colors.sky800,
  statusDeliveredBg: primitives.colors.emerald50,
  statusDeliveredText: primitives.colors.emerald800, // Distinct natural green, never confused with blue
  statusCancelledBg: primitives.colors.red50,
  statusCancelledText: primitives.colors.red800,

  // Semantic Alerts
  success: primitives.colors.emerald800,
  warning: primitives.colors.amber800,
  danger: primitives.colors.red600,
  info: primitives.colors.sky800,

  // --------------------------------------------------------------------------
  // @deprecated Old glassmorphism & blue tokens retained temporarily for unrefactored screens.
  // Will be completely removed after the final screen group is modernized.
  // --------------------------------------------------------------------------
  /** @deprecated Use colors.surfaceSubtle or colors.bg instead */
  parchment: primitives.colors.gray50,
  /** @deprecated Use colors.glassBg instead */
  glassFill: "rgba(255, 255, 255, 0.22)",
  /** @deprecated Use colors.glassBgStrong instead */
  glassFillStrong: "rgba(255, 255, 255, 0.85)",
  /** @deprecated Flat style does not use tinted shadows */
  shadowTint: "rgba(0, 0, 0, 0.08)",
  /** @deprecated Drone indicator uses primary blue */
  droneBlue: primitives.colors.blue600,
  /** @deprecated Drone indicator uses statusDeliveredText */
  droneGreen: primitives.colors.emerald800,
  /** @deprecated Drone indicator uses warning */
  droneOrange: primitives.colors.amber800,
  /** @deprecated Battery indicator uses success */
  batteryHigh: primitives.colors.emerald800,
  /** @deprecated Battery indicator uses warning */
  batteryMed: primitives.colors.amber800,
  /** @deprecated Battery indicator uses danger */
  batteryLow: primitives.colors.red600,
};

// ============================================================================
// SPACING (8px GRID SYSTEM & COMPONENT TOKENS)
// ============================================================================

export const spacing = {
  // 8px Grid System (Layout, Outer Margins & Component Gaps)
  xxs: 4,  // Micro spacing / Half-step
  xs: 8,   // Base 8px unit
  md: 16,  // Regular layout gap
  xl: 24,  // Section gap
  xxl: 32, // Large section gap
  xxxl: 40,// Screen hero gap
  screenPadding: 16,

  // Component Internal Padding (for chip, input, button internals)
  component: {
    paddingXs: 4,
    paddingSm: 8,
    paddingMd: 12, // 12px internal padding for chips & inputs
    paddingLg: 16,
  },

  /** @deprecated Kept temporarily for unrefactored screens. Refactored screens use 8px grid. */
  sm: 12,
  /** @deprecated Kept temporarily for unrefactored screens. Refactored screens use 16/24. */
  lg: 20,
};

// ============================================================================
// BORDER RADIUS (PILL GEOMETRY)
// ============================================================================

export const radius = {
  xs: 6,
  sm: 12,   // Small inputs / micro badges
  md: 16,   // Product cards / promo items
  lg: 20,   // Big banner cards / bottom sheets
  xl: 20,
  sheet: 24, // Modal & Bottom sheet top corners
  pill: 9999, // Pill buttons, search bars, filter chips
};

// ============================================================================
// TYPOGRAPHY (PURE SYSTEM FONTS - NO FONTFAMILY DEFINITIONS)
// ============================================================================

/**
 * Standard font weights mapped to React Native TextStyle fontWeight.
 * Note: On Android Roboto, 600 and 700 are mapped to Roboto-Bold by the OS.
 */
export const fontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semiBold: "600" as const,
  bold: "700" as const,
};

export const typography = {
  // Screen title (~18-20px medium)
  screenTitle: { fontSize: 19, lineHeight: 24, fontWeight: fontWeights.medium },
  // Section headers
  sectionTitle: { fontSize: 16, lineHeight: 22, fontWeight: fontWeights.semiBold },
  // Food / Item Title (~13-14px)
  foodTitle: { fontSize: 14, lineHeight: 18, fontWeight: fontWeights.medium },
  // Price Tag (semi-bold)
  price: { fontSize: 14, lineHeight: 18, fontWeight: fontWeights.semiBold },
  // Body text
  body: { fontSize: 14, lineHeight: 20, fontWeight: fontWeights.regular },
  bodySecondary: { fontSize: 13, lineHeight: 18, fontWeight: fontWeights.regular },
  // Caption & Status labels
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeights.medium },
  // Micro-label (~10px)
  micro: { fontSize: 10, lineHeight: 14, fontWeight: fontWeights.medium },

  // --------------------------------------------------------------------------
  // Legacy aliases mapped without fontFamily to prevent breaking unrefactored screens
  // --------------------------------------------------------------------------
  hero: { fontSize: 26, lineHeight: 32, fontWeight: fontWeights.bold },
  title1: { fontSize: 22, lineHeight: 28, fontWeight: fontWeights.bold },
  title2: { fontSize: 19, lineHeight: 24, fontWeight: fontWeights.medium },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: fontWeights.medium },
  subheadBold: { fontSize: 15, lineHeight: 20, fontWeight: fontWeights.semiBold },
  captionBold: { fontSize: 12, lineHeight: 16, fontWeight: fontWeights.bold },
  mono: { fontSize: 12, lineHeight: 16, fontWeight: fontWeights.semiBold },
};

// ============================================================================
// SHADOWS (FLAT AESTHETIC - MINIMAL TO NO SHADOWS)
// ============================================================================

export const shadows = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  floating: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  /** @deprecated Glass style replaced by subtle flat shadow */
  glass: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
};

// ============================================================================
// MOTION & INTERACTION
// ============================================================================

export const motion = {
  pressedOpacity: 0.82,
  pressedScale: 0.985,
};
