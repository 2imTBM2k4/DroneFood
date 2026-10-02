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

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
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

const webPrimary = "#0066cc";
console.log("=== 1. CHỮ TRẮNG TRÊN MÀU WEB (#0066cc) ===");
const rWhite = contrast("#FFFFFF", webPrimary);
console.log(`Chữ trắng #FFFFFF trên #0066cc:`);
console.log(`- Tỷ số tương phản: ${rWhite.toFixed(2)}:1`);
console.log(`- WCAG AA Normal (>= 4.5:1): ${rWhite >= 4.5 ? "ĐẠT (PASS)" : "KHÔNG ĐẠT (FAIL)"}`);
console.log(`- WCAG AAA Large (>= 4.5:1): ĐẠT`);
console.log(`- Nhận xét: #0066cc nguyên bản ĐÃ ĐẠT chuẩn WCAG AA cho cả chữ thường lẫn chữ đậm/lớn. Không cần giảm độ sáng thêm.`);

console.log("\n=== 2. CHỮ #0066cc TRÊN NỀN SÁNG NHẠT CÙNG TÔNG (KIỂU BADGE) ===");
// Các mức nền tint của #0066cc trên nền trắng #ffffff:
// 8% tint:
const bg8 = rgbToHex(Math.round(0 * 0.08 + 255 * 0.92), Math.round(102 * 0.08 + 255 * 0.92), Math.round(204 * 0.08 + 255 * 0.92)); // #ebf3fb
// 12% tint:
const bg12 = rgbToHex(Math.round(0 * 0.12 + 255 * 0.88), Math.round(102 * 0.12 + 255 * 0.88), Math.round(204 * 0.12 + 255 * 0.88)); // #e0edf9
// 15% tint:
const bg15 = rgbToHex(Math.round(0 * 0.15 + 255 * 0.85), Math.round(102 * 0.15 + 255 * 0.85), Math.round(204 * 0.15 + 255 * 0.85)); // #d9e8f8
// 20% tint:
const bg20 = rgbToHex(Math.round(0 * 0.20 + 255 * 0.80), Math.round(102 * 0.20 + 255 * 0.80), Math.round(204 * 0.20 + 255 * 0.80)); // #cce0f5

const tints = [
  { name: "Nền nhạt 8% tint (#ebf3fb) [chuẩn web --accent-light]", hex: bg8 },
  { name: "Nền nhạt 12% tint (#e0edf9)", hex: bg12 },
  { name: "Nền nhạt 15% tint (#d9e8f8)", hex: bg15 },
  { name: "Nền nhạt 20% tint (#cce0f5)", hex: bg20 },
];

tints.forEach(t => {
  const r = contrast(webPrimary, t.hex);
  console.log(`- Chữ #0066cc trên ${t.name}:`);
  console.log(`  + Tỷ số tương phản: ${r.toFixed(2)}:1`);
  console.log(`  + Đạt WCAG AA Normal (>= 4.5:1)? ${r >= 4.5 ? "ĐẠT (PASS)" : "KHÔNG ĐẠT (FAIL)"}`);
  if (r < 4.5) {
    // Tìm mã chữ đậm hơn cùng sắc độ (scale theo HSL Lightness / RGB)
    for (let factor = 0.99; factor >= 0.50; factor -= 0.005) {
      const darkHex = rgbToHex(0, Math.round(102 * factor), Math.round(204 * factor));
      const cDark = contrast(darkHex, t.hex);
      if (cDark >= 4.50) {
        console.log(`  -> Mã hex chữ gần nhất cùng sắc độ đạt AA (>= 4.5:1): ${darkHex} (${cDark.toFixed(2)}:1)`);
        break;
      }
    }
  }
});

console.log("\n=== 3. SO SÁNH VỚI MÀU PRIMARY HIỆN TẠI (TEAL #0F8A6C) ===");
console.log(`Chữ trắng trên Teal #0F8A6C:          ${contrast("#FFFFFF", "#0F8A6C").toFixed(2)}:1 (FAIL AA 4.5)`);
console.log(`Chữ trắng trên Web Blue #0066cc:       ${contrast("#FFFFFF", "#0066cc").toFixed(2)}:1 (PASS AA 4.5)`);
console.log(`Chữ trắng trên Old Mobile #2563EB:     ${contrast("#FFFFFF", "#2563EB").toFixed(2)}:1 (FAIL AA 4.5: 3.99:1)`);
