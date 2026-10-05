function getLuminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function hexToRgb(hex) {
  const cleanHex = hex.replace("#", "");
  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16)
  };
}

function contrast(hex1, hex2) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const l1 = getLuminance(c1.r, c1.g, c1.b);
  const l2 = getLuminance(c2.r, c2.g, c2.b);
  const max = Math.max(l1, l2);
  const min = Math.min(l1, l2);
  return (max + 0.05) / (min + 0.05);
}

function blend(fgRgba, bgHex) {
  const bg = hexToRgb(bgHex);
  const r = Math.round(fgRgba.r * fgRgba.a + bg.r * (1 - fgRgba.a));
  const g = Math.round(fgRgba.g * fgRgba.a + bg.g * (1 - fgRgba.a));
  const b = Math.round(fgRgba.b * fgRgba.a + bg.b * (1 - fgRgba.a));
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

const pairs = [
  { label: "1. Chữ trắng trên Primary Blue (#0066CC) [Nút, CartBar]", fg: "#FFFFFF", bg: "#0066CC" },
  { label: "2. Chữ Primary (#0066CC) trên Badge Tint (#EBF3FB)", fg: "#0066CC", bg: "#EBF3FB" },
  { label: "3. Chữ phụ (#666666) trên nền Canvas (#F8F8F8)", fg: "#666666", bg: "#F8F8F8" },
  { label: "4. Chữ phụ (#666666) trên nền Subtle (#EFEFEF)", fg: "#666666", bg: "#EFEFEF" },
  { label: "5. Placeholder (#666666) trên Search/Input (#EFEFEF)", fg: "#666666", bg: "#EFEFEF" },
  { label: "6. Placeholder (#666666) trên Input trắng (#FFFFFF)", fg: "#666666", bg: "#FFFFFF" },
  { label: "7. Đơn: Pending (#92400E trên #FEF3C7)", fg: "#92400E", bg: "#FEF3C7" },
  { label: "8. Đơn: Preparing (#5B21B6 trên #EDE9FE)", fg: "#5B21B6", bg: "#EDE9FE" },
  { label: "9. Đơn: Delivering (#075985 trên #E0F2FE)", fg: "#075985", bg: "#E0F2FE" },
  { label: "10. Đơn: Delivered (#166534 trên #DCFCE7)", fg: "#166534", bg: "#DCFCE7" },
  { label: "11. Đơn: Cancelled (#991B1B trên #FEE2E2)", fg: "#991B1B", bg: "#FEE2E2" },
  { label: "12. Chữ chính (#1A1A1A) trên Canvas (#F8F8F8)", fg: "#1A1A1A", bg: "#F8F8F8" },
  { label: "13. Chữ chính (#1A1A1A) trên Card (#FFFFFF)", fg: "#1A1A1A", bg: "#FFFFFF" },
];

console.log("=== BẢNG TÍNH TOÁN WCAG 2.1 TOÀN BỘ CẶP MÀU MỚI ===");
pairs.forEach(p => {
  const r = contrast(p.fg, p.bg);
  console.log(`${p.label.padEnd(55)} | FG: ${p.fg.padEnd(7)} | BG: ${p.bg.padEnd(7)} | ${r.toFixed(2)}:1 | WCAG AA Normal(>=4.5): ${r >= 4.5 ? "PASS" : "FAIL"}`);
});

console.log("\n=== NÚT GLASS TRÊN BANNER CÓ LỚP PHỦ GRADIENT TỐI (SCRIM) ===");
// When banner has dark scrim rgba(0,0,0,0.65) over light image #FFFFFF -> composite background is #595959
const darkScrimOverWhite = blend({ r: 0, g: 0, b: 0, a: 0.65 }, "#FFFFFF");
// Glass button rgba(255,255,255,0.22) over that scrim
const glassOverScrim = blend({ r: 255, g: 255, b: 255, a: 0.22 }, darkScrimOverWhite);
const rGlassOnScrim = contrast("#FFFFFF", glassOverScrim);
console.log(`Banner ảnh trắng sáng + scrim 65% (${darkScrimOverWhite}) -> Nền nút glass: ${glassOverScrim}`);
console.log(`Chữ trắng #FFFFFF trên nút glass có scrim: ${rGlassOnScrim.toFixed(2)}:1 -> ${rGlassOnScrim >= 4.5 ? "PASS WCAG AA Normal" : "FAIL"}`);
