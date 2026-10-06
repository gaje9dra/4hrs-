import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("Phase 16.12 certification is wired into package and CI", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };
  const ci = await readFile(".github/workflows/ci.yml", "utf8");
  assert.equal(pkg.scripts["production-certification:phase-16-12"], "tsx scripts/phase-16-12-frontend-accessibility-certification.ts");
  assert.match(ci, /production-certification:phase-16-12/);
});

test("Phase 16.12 preserves the single document main landmark", async () => {
  const layout = await readFile("app/layout.tsx", "utf8");
  const checkout = await readFile("components/storefront/checkout-page.tsx", "utf8");
  assert.match(layout, /<main id="main-content"/);
  assert.doesNotMatch(checkout, /<main[\s>]/);
});

test("Phase 16.12 mobile navigation retains keyboard focus management", async () => {
  const source = await readFile("components/layout/mobile-nav.tsx", "utf8");
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /Escape/);
  assert.match(source, /document\.body\.style\.overflow\s*=\s*['"]hidden['"]/);
  assert.match(source, /trigger\?\.focus\(\)/);
});

test("Phase 16.12 global accessibility primitives remain enabled", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /--primary-red:\s*#D02020/);
  assert.match(css, /--primary-blue:\s*#1040C0/);
  assert.match(css, /--primary-yellow:\s*#F0C020/);
});
