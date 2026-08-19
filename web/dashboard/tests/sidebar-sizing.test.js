import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  clampSidebarWidth,
  sidebarWidthFromPointer,
} from "../src/lib/stores/sidebar-sizing.js";

const themeTogglePath = fileURLToPath(
  new URL("../src/lib/components/organisms/ThemeToggle.svelte", import.meta.url),
);
const themeToggleSource = readFileSync(themeTogglePath, "utf8");

test("sidebar width stays within the folded and unfolded bounds", () => {
  assert.equal(clampSidebarWidth(20), MIN_SIDEBAR_WIDTH);
  assert.equal(clampSidebarWidth(175.6), 176);
  assert.equal(clampSidebarWidth(400), MAX_SIDEBAR_WIDTH);
});

test("sidebar dragging follows horizontal pointer movement within its bounds", () => {
  assert.equal(sidebarWidthFromPointer(180, 180, 210), 210);
  assert.equal(sidebarWidthFromPointer(180, 180, 100), 100);
  assert.equal(sidebarWidthFromPointer(80, 100, 20), MIN_SIDEBAR_WIDTH);
  assert.equal(sidebarWidthFromPointer(220, 100, 160), MAX_SIDEBAR_WIDTH);
});

test("sidebar theme selector keeps its intrinsic width inside the grid footer", () => {
  assert.match(
    themeToggleSource,
    /\.theme-toggle\s*\{[^}]*\bjustify-self:\s*start\s*;/s,
  );
});
