// Verifies every text/UI color pairing in globals.css meets WCAG AA in every theme combination.
// Run: npm run contrast   (exits 1 on any failure)
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const out = {};
  for (const m of body.matchAll(/--c-([\w-]+):\s*(#[0-9a-f]{6});/gi)) out[m[1]] = m[2];
  return out;
}

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const grounds = ["bg", "surface", "raised", "sunken"];
const checks = [
  // [foreground, backgrounds, minimum]
  ...["ink", "ink-2", "ink-3"].map((f) => [f, grounds, 4.5]),
  ["accent", ["bg", "surface", "raised", "accent-soft"], 4.5],
  ["ink", ["accent-soft", "success-soft", "warning-soft", "danger-soft"], 4.5],
  ["accent-ink", ["accent", "accent-hover"], 4.5],
  ["success", ["bg", "surface", "raised", "success-soft"], 4.5],
  ["warning", ["bg", "surface", "raised", "warning-soft"], 4.5],
  ["danger", ["bg", "surface", "raised", "danger-soft"], 4.5],
  ...["p1", "p2", "p3", "p4"].map((f) => [f, ["bg", "surface", "raised"], 4.5]),
  // Non-text UI (control borders, focus ring): 3:1. line/line-strong are decorative dividers.
  ["control", ["bg", "surface", "raised"], 3],
  ["focus", ["bg", "surface", "raised"], 3],
];

// Each combination the app can show: theme × contrast × accent, built the way the cascade builds it.
const themes = [
  ["light", [":root"]],
  ["dark", [":root", '[data-theme="dark"]']],
];
const contrasts = [
  ["standard", { light: [], dark: [] }],
  ["high", { light: ['[data-theme="light"][data-contrast="high"]'], dark: ['[data-theme="dark"][data-contrast="high"]'] }],
];
const accents = [
  ["fern", { light: [], dark: [] }],
  ...["vermilion", "plum", "ink"].map((a) => [a, { light: [`[data-accent="${a}"]`], dark: [`[data-accent="${a}"]`, `[data-theme="dark"][data-accent="${a}"]`] }]),
];

let failed = 0;
let combos = 0;
for (const [theme, base] of themes)
  for (const [contrast, cSel] of contrasts)
    for (const [accent, aSel] of accents) {
      const t = Object.assign({}, ...[...base, ...aSel[theme], ...cSel[theme]].map(block));
      const name = `${theme} · ${contrast} · ${accent}`;
      combos++;
      let header = false;
      for (const [fg, bgs, min] of checks) {
        // High contrast promises AAA (7:1) for body text.
        const need = contrast === "high" && ["ink", "ink-2", "ink-3"].includes(fg) && grounds.includes(bgs[0]) ? 7 : min;
        for (const bg of bgs) {
          const r = ratio(t[fg], t[bg]);
          const ok = r >= need;
          if (!ok) failed++;
          if (!ok || process.argv.includes("--all")) {
            if (!header) console.log(`
${name}`), (header = true);
            console.log(`  ${ok ? "ok  " : "FAIL"} ${fg.padEnd(12)} on ${bg.padEnd(13)} ${r.toFixed(2)} (min ${need})`);
          }
        }
      }
    }
console.log(failed ? `
${failed} pairing(s) below target` : `
All pairings pass in all ${combos} theme combinations (AA; AAA body text in high contrast).`);
process.exit(failed ? 1 : 0);
