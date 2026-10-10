import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("admin action buttons keep readable contrast without changing Catalog styles", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const adminButtonRules = css.slice(css.indexOf("/* Admin action buttons must keep readable foreground/background contrast."));
  assert.match(adminButtonRules, /\.admin-polish-surface:not\(\[data-admin-polish-route\^="\/admin\/catalog"\]\)/);
  assert.match(adminButtonRules, /\[class\*="bg-black"\]/);
  assert.match(adminButtonRules, /\[class\*="bg-stone-900"\]/);
  assert.match(adminButtonRules, /color: #fff !important/);
  assert.match(adminButtonRules, /-webkit-text-fill-color: #fff/);
  assert.match(adminButtonRules, /:disabled/);
  assert.match(adminButtonRules, /color: #57534e !important/);
});
