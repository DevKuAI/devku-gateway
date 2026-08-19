import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const themesPath = fileURLToPath(
  new URL("../src/styles/themes.css", import.meta.url),
);
const themesSource = readFileSync(themesPath, "utf8");

function ruleBody(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing CSS rule: ${marker}`);

  const openIndex = source.indexOf("{", markerIndex);
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }

  assert.fail(`unclosed CSS rule: ${marker}`);
}

function customProperties(body) {
  return Object.fromEntries(
    [...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].replace(/\s+/g, " ").trim(),
    ]),
  );
}

test("light theme uses the DevKu operations-console tokens", () => {
  const tokens = customProperties(
    ruleBody(themesSource, '\n[data-theme="light"] {'),
  );

  assert.deepEqual(
    Object.fromEntries(
      [
        "bg",
        "bg-surface",
        "bg-surface-hover",
        "border",
        "border-strong",
        "text",
        "text-muted",
        "text-faint",
        "accent-solid",
        "accent-solid-hover",
        "accent-text",
        "accent-strong",
        "accent-soft",
        "text-on-accent",
      ].map((key) => [key, tokens[key]]),
    ),
    {
      bg: "#f7f8fa",
      "bg-surface": "#ffffff",
      "bg-surface-hover": "#f3f4f6",
      border: "#e5e7eb",
      "border-strong": "#d1d5db",
      text: "#121722",
      "text-muted": "#626873",
      "text-faint": "#6b707a",
      "accent-solid": "#0068f9",
      "accent-solid-hover": "#024bb1",
      "accent-text": "#0074dd",
      "accent-strong": "#024bb1",
      "accent-soft": "rgba(0, 104, 249, 0.08)",
      "text-on-accent": "#ffffff",
    },
  );
  assert.equal(tokens.accent, "var(--accent-text)");
  assert.equal(tokens["accent-hover"], "var(--accent-solid-hover)");
});

test("explicit and system light themes expose the same tokens", () => {
  const explicitLight = customProperties(
    ruleBody(themesSource, '\n[data-theme="light"] {'),
  );
  const systemLight = customProperties(
    ruleBody(themesSource, ':root:not([data-theme="dark"])'),
  );

  assert.deepEqual(systemLight, explicitLight);
});

test("dark theme keeps readable fill and navigation accents", () => {
  const tokens = customProperties(ruleBody(themesSource, "\n:root {"));

  assert.equal(tokens["accent-solid"], "#0068f9");
  assert.equal(tokens["accent-solid-hover"], "#024bb1");
  assert.equal(tokens["accent-text"], "#60a5fa");
  assert.equal(tokens["accent-strong"], "#93c5fd");
  assert.equal(tokens["accent-soft"], "rgba(0, 104, 249, 0.16)");
});
