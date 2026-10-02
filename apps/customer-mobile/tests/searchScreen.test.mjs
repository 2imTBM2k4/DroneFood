import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(process.cwd());

test("Search Screen Architecture and GrabFood/Shopee UX Adherence", async (t) => {
  const searchScreenSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/search/SearchScreen.tsx"),
    "utf8"
  );
  const homeScreenSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/home/HomeScreen.tsx"),
    "utf8"
  );
  const appSrc = fs.readFileSync(
    path.join(ROOT, "App.tsx"),
    "utf8"
  );
  const typesSrc = fs.readFileSync(
    path.join(ROOT, "src/types/index.ts"),
    "utf8"
  );

  await t.test("SearchScreen adheres to design system rules and accessibility", () => {
    assert.ok(!searchScreenSrc.includes("GlassSurface"), "SearchScreen must not use GlassSurface");
    assert.ok(!searchScreenSrc.includes("fontFamily"), "SearchScreen must not specify custom fontFamily");
    assert.ok(searchScreenSrc.includes('accessibilityRole="search"'), "SearchScreen has search input accessibility role");
    assert.ok(searchScreenSrc.includes("autoFocus={true}"), "Search input auto-focuses upon opening");
    assert.ok(searchScreenSrc.includes("chevron-left"), "Back navigation button uses chevron-left icon");
    assert.ok(searchScreenSrc.includes("width: 44") && searchScreenSrc.includes("height: 44"), "Touch targets meet >=44x44 requirement");
  });

  await t.test("SearchScreen includes recent searches, trending items, and category exploration", () => {
    assert.ok(searchScreenSrc.includes("Tìm kiếm gần đây"), "SearchScreen displays recent search history section");
    assert.ok(searchScreenSrc.includes("Xóa tất cả"), "SearchScreen provides clear all history action");
    assert.ok(searchScreenSrc.includes("Món hot tìm nhiều nhất"), "SearchScreen displays trending search suggestions");
    assert.ok(searchScreenSrc.includes("Khám phá danh mục"), "SearchScreen displays category suggestions");
    assert.ok(searchScreenSrc.includes("Không tìm thấy kết quả"), "SearchScreen provides friendly empty state");
  });

  await t.test("HomeScreen search trigger navigates to SearchScreen", () => {
    assert.ok(homeScreenSrc.includes("onNavigateSearch"), "HomeScreen supports onNavigateSearch prop");
    assert.ok(homeScreenSrc.includes("searchTrigger"), "HomeScreen renders searchTrigger button");
  });

  await t.test("App.tsx integrates SearchScreen into router and ScreenName", () => {
    assert.ok(typesSrc.includes('"search"'), 'ScreenName union contains "search"');
    assert.ok(appSrc.includes('screen === "search"'), "App.tsx handles screen === search");
    assert.ok(appSrc.includes('screen !== "search"'), "App.tsx hides bottom TabBar when in search screen");
  });
});
