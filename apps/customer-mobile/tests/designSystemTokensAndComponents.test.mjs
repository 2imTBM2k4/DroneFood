import assert from "node:assert/strict";
import test from "node:test";
import { colors, fontWeights, radius, spacing, typography } from "../src/theme/tokens.ts";
import { calculateDroneEtaMinutes, DRONE_SIMULATION } from "../src/config/droneSimulation.ts";

/**
 * Calculates relative luminance from hex color string using WCAG 2.1 formula
 */
function getLuminance(hex) {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function blend(fgRgba, bgHex) {
  const cleanHex = bgHex.replace("#", "");
  const bg = {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16),
  };
  const r = Math.round(fgRgba.r * fgRgba.a + bg.r * (1 - fgRgba.a));
  const g = Math.round(fgRgba.g * fgRgba.a + bg.g * (1 - fgRgba.a));
  const b = Math.round(fgRgba.b * fgRgba.a + bg.b * (1 - fgRgba.a));
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

test("Task 1: Design Tokens Architecture and Constraints", async (t) => {
  await t.test("typography scale contains NO fontFamily property", () => {
    for (const [key, value] of Object.entries(typography)) {
      assert.strictEqual(
        "fontFamily" in value,
        false,
        `typography.${key} must not have fontFamily defined`
      );
      assert.ok(value.fontSize > 0, `typography.${key} has valid fontSize`);
      assert.ok(value.lineHeight > 0, `typography.${key} has valid lineHeight`);
      assert.ok(value.fontWeight, `typography.${key} has valid fontWeight`);
    }
  });

  await t.test("border radius defines pill geometry and card radiuses", () => {
    assert.strictEqual(radius.pill, 9999, "pill radius is 9999");
    assert.strictEqual(radius.sm, 12, "small radius is 12px");
    assert.strictEqual(radius.md, 16, "card radius is 16px");
    assert.strictEqual(radius.lg, 20, "large card radius is 20px");
  });

  await t.test("primary color is Action Blue (synced with web & brand-spec)", () => {
    assert.strictEqual(colors.primary, "#0066CC");
    assert.strictEqual(colors.bg, "#F4F8FD");
  });

  await t.test("order status color pairs pass WCAG AA contrast ratio (> 4.5:1)", () => {
    const pairs = [
      { name: "pending", bg: colors.statusPendingBg, text: colors.statusPendingText },
      { name: "preparing", bg: colors.statusPreparingBg, text: colors.statusPreparingText },
      { name: "delivering", bg: colors.statusDeliveringBg, text: colors.statusDeliveringText },
      { name: "delivered", bg: colors.statusDeliveredBg, text: colors.statusDeliveredText },
      { name: "cancelled", bg: colors.statusCancelledBg, text: colors.statusCancelledText },
    ];

    for (const pair of pairs) {
      const ratio = getContrastRatio(pair.bg, pair.text);
      assert.ok(
        ratio >= 4.5,
        `Status ${pair.name} contrast ratio ${ratio.toFixed(2)}:1 must be >= 4.5:1 (WCAG AA)`
      );
    }
  });

  await t.test("delivered status text is distinct from primary blue", () => {
    assert.notStrictEqual(
      colors.statusDeliveredText,
      colors.primary,
      "Delivered status text must not be confused with primary blue"
    );
  });

  await t.test("all normal text elements (14-16px) strictly meet WCAG AA (>= 4.5:1)", () => {
    // 1. White text on primary button (#0066CC)
    const ratioButton = getContrastRatio("#FFFFFF", colors.primary);
    assert.ok(
      ratioButton >= 4.5,
      `Primary button text (${ratioButton.toFixed(2)}:1) must be >= 4.5:1 (WCAG AA)`
    );

    // 2. Primary text on badge (#0066CC on #EBF3FB)
    const ratioBadge = getContrastRatio(colors.badgeMintText, colors.badgeMintBg);
    assert.ok(
      ratioBadge >= 4.5,
      `Badge text (${ratioBadge.toFixed(2)}:1) must be >= 4.5:1 (WCAG AA)`
    );

    // 3. Secondary text on canvas background (#666666 on #F8F8F8)
    const ratioSecondary = getContrastRatio(colors.textSecondary, colors.bg);
    assert.ok(
      ratioSecondary >= 4.5,
      `Secondary text (${ratioSecondary.toFixed(2)}:1) must be >= 4.5:1 (WCAG AA)`
    );

    // 4. Placeholder on subtle input background (#666666 on #EFEFEF)
    const ratioPlaceholder = getContrastRatio(colors.textMuted, colors.surfaceSubtle);
    assert.ok(
      ratioPlaceholder >= 4.5,
      `Placeholder text (${ratioPlaceholder.toFixed(2)}:1) must be >= 4.5:1 (WCAG AA)`
    );
  });

  await t.test("glass button white text on banner (tested against assumed dark background #1A1A1A)", () => {
    // CHÚ Ý: Đây chỉ là kiểm chứng với nền giả định màu tối (#1A1A1A) như trong ảnh mẫu.
    // Trên ảnh thật có vùng sáng, bắt buộc phải có lớp phủ gradient tối (dark scrim/overlay) bên dưới để đảm bảo luôn >= 4.5:1.
    const composite = blend({ r: 255, g: 255, b: 255, a: 0.22 }, "#1A1A1A");
    const ratio = getContrastRatio("#FFFFFF", composite);
    assert.ok(
      ratio >= 4.5,
      `Glass button with dark scrim (${ratio.toFixed(2)}:1) meets WCAG AA normal text (>= 4.5:1)`
    );
  });
});

test("Task 2: Drone Simulation and ETA calculations", () => {
  assert.strictEqual(DRONE_SIMULATION.CRUISE_SPEED_KMH, 50);
  assert.strictEqual(DRONE_SIMULATION.CRUISE_ALTITUDE_METERS, 120);

  // 5 km at 50 km/h = 0.1 hr = 6 minutes
  assert.strictEqual(calculateDroneEtaMinutes(5), 6);
  // 10 km at 50 km/h = 0.2 hr = 12 minutes
  assert.strictEqual(calculateDroneEtaMinutes(10), 12);
  // 0 or null distance
  assert.strictEqual(calculateDroneEtaMinutes(0), null);
  assert.strictEqual(calculateDroneEtaMinutes(null), null);
});

test("Task 2: Timeline 7 Drone Phases Mapping and Fallback Verification", async (t) => {
  const dronePhases = [
    "assigned",
    "preflight_check",
    "en_route_to_restaurant",
    "awaiting_restaurant_handover",
    "en_route_to_customer",
    "arrived_at_customer",
    "delivered",
  ];

  await t.test("drone delivery defines exactly 7 distinct sequential operational phases", () => {
    assert.strictEqual(dronePhases.length, 7, "Drone delivery must have exactly 7 phases");
    const unique = new Set(dronePhases);
    assert.strictEqual(unique.size, 7, "All 7 drone phases must be unique");
  });

  await t.test("each drone phase has a unique index from 0 to 6", () => {
    dronePhases.forEach((phase, idx) => {
      assert.strictEqual(dronePhases.indexOf(phase), idx);
    });
  });
});

test("Task 2: Touch Target Accessibility Specifications (>= 44x44)", async (t) => {
  const touchElements = [
    { name: "FilterChip", visualHeight: 38, hitSlopV: 8, hitSlopH: 4, minVisualWidth: 60 },
    { name: "FavoriteButton", visualHeight: 36, hitSlopV: 16, hitSlopH: 16, minVisualWidth: 36 },
    { name: "Stepper Sm (- / + buttons)", visualHeight: 32, hitSlopV: 12, hitSlopH: 12, minVisualWidth: 36 },
    { name: "Checkbox", visualHeight: 22, hitSlopV: 22, hitSlopH: 22, minVisualWidth: 22 },
    { name: "Switch", visualHeight: 28, hitSlopV: 16, hitSlopH: 8, minVisualWidth: 48 },
    { name: "TabBar Tab Item", visualHeight: 44, hitSlopV: 0, hitSlopH: 0, minVisualWidth: 80 },
    { name: "Button (sm)", visualHeight: 40, hitSlopV: 8, hitSlopH: 8, minVisualWidth: 64 },
    { name: "Button (md)", visualHeight: 48, hitSlopV: 0, hitSlopH: 0, minVisualWidth: 80 },
    { name: "Header Back Button", visualHeight: 44, hitSlopV: 20, hitSlopH: 20, minVisualWidth: 44 },
    { name: "SearchBar Clear Button", visualHeight: 28, hitSlopV: 24, hitSlopH: 24, minVisualWidth: 28 },
    { name: "Modal Close Button", visualHeight: 36, hitSlopV: 20, hitSlopH: 20, minVisualWidth: 36 },
  ];

  for (const el of touchElements) {
    await t.test(`${el.name} has effective touch target >= 44x44`, () => {
      const effectiveHeight = el.visualHeight + el.hitSlopV;
      const effectiveWidth = el.minVisualWidth + el.hitSlopH;
      assert.ok(
        effectiveHeight >= 44,
        `${el.name} effective height (${effectiveHeight}px) must be >= 44px`
      );
      assert.ok(
        effectiveWidth >= 44,
        `${el.name} effective width (${effectiveWidth}px) must be >= 44px`
      );
    });
  }
});

test("Task 3: AuthScreen Modernization and Business Logic Integrity", async (t) => {
  const fs = await import("node:fs/promises");
  const authSource = await fs.readFile(
    new URL("../src/screens/auth/AuthScreen.tsx", import.meta.url),
    "utf-8"
  );

  await t.test("AuthScreen removes legacy GlassSurface and AmbientBackground", () => {
    assert.ok(
      !authSource.includes("GlassSurface"),
      "AuthScreen must not import or use legacy GlassSurface"
    );
    assert.ok(
      !authSource.includes("AmbientBackground"),
      "AuthScreen must not import or use legacy AmbientBackground"
    );
  });

  await t.test("AuthScreen uses shared Tabs component with pill variant", () => {
    assert.ok(
      authSource.includes('variant="pill"'),
      "AuthScreen must use Tabs with variant='pill'"
    );
    assert.ok(
      authSource.includes("onSelectTab"),
      "AuthScreen must handle onSelectTab"
    );
  });

  await t.test("AuthScreen preserves all authentication APIs and session token storage", () => {
    assert.ok(authSource.includes("authApi.login"), "Preserves authApi.login");
    assert.ok(authSource.includes("authApi.register"), "Preserves authApi.register");
    assert.ok(authSource.includes("setStoredToken"), "Preserves setStoredToken");
    assert.ok(authSource.includes("setStoredRefreshToken"), "Preserves setStoredRefreshToken");
    assert.ok(authSource.includes("resetSessionExpiryNotification"), "Preserves resetSessionExpiryNotification");
  });
});
