import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("Phase 16.13 certification is wired into package and CI", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };
  const ci = await readFile(".github/workflows/ci.yml", "utf8");
  assert.equal(pkg.scripts["production-certification:phase-16-13"], "tsx scripts/phase-16-13-seo-certification.ts");
  assert.match(ci, /production-certification:phase-16-13/);
  assert.match(ci, /phase-16-13-seo-certification-evidence/);
});

test("Phase 16.13 keeps the existing SEO architecture authoritative", async () => {
  const [robots, sitemap, catalog, structured] = await Promise.all([
    readFile("app/robots.ts", "utf8"), readFile("app/sitemap.ts", "utf8"),
    readFile("lib/catalog/seo.ts", "utf8"), readFile("lib/seo/structured-data.ts", "utf8"),
  ]);
  assert.match(robots, /sitemap\.xml/);
  assert.match(sitemap, /MetadataRoute\.Sitemap/);
  assert.match(catalog, /productCanonicalUrl/);
  assert.match(structured, /serializeJsonLd/);
});

test("Phase 16.13 protects private routes from indexing", async () => {
  const [nextConfig, admin, account] = await Promise.all([
    readFile("next.config.ts", "utf8"), readFile("app/admin/layout.tsx", "utf8"), readFile("app/(storefront)/account/page.tsx", "utf8"),
  ]);
  assert.match(nextConfig, /X-Robots-Tag/);
  assert.match(admin, /index:\s*false/);
  assert.match(account, /index:\s*false/);
});

test("Phase 16.13 explicitly records unavailable external evidence", async () => {
  const script = await readFile("scripts/phase-16-13-seo-certification.ts", "utf8");
  assert.match(script, /External search-engine validation/);
  assert.match(script, /no indexing claim is made/);
});