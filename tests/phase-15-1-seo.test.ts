import test from "node:test";
import assert from "node:assert/strict";
import { getProductionSiteOrigin, getSiteOrigin } from "../config/site.ts";
import { productJsonLd, serializeJsonLd } from "../lib/seo/structured-data.ts";

const previous = process.env.NEXT_PUBLIC_SITE_URL;
test.after(() => {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previous;
});

test("trusted canonical origin rejects credentials, query strings and fragments", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com/?x=1";
  assert.throws(() => getSiteOrigin(), /query parameters/);
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com";
  assert.equal(getProductionSiteOrigin().toString(), "https://shop.example.com/");
});

test("production SEO origin requires HTTPS", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://shop.example.com";
  assert.throws(() => getProductionSiteOrigin(), /HTTPS/);
});

test("product JSON-LD uses canonical catalog fields and store SKU without fabricated reviews", () => {
  const schema = productJsonLd({
    name: "Graphic Tee",
    description: "Canonical catalog description.",
    url: "https://shop.example.com/product/graphic-tee",
    imageUrls: ["/media/graphic-tee.jpg"],
    price: "999.00",
    currency: "INR",
    sku: "4HRS-GRAPHIC-TEE-M",
    availability: "IN_STOCK",
  });
  assert.equal(schema["@type"], "Product");
  assert.equal(schema.sku, "4HRS-GRAPHIC-TEE-M");
  assert.equal((schema.offers as Record<string, unknown>).price, "999.00");
  assert.equal((schema.offers as Record<string, unknown>).priceCurrency, "INR");
  assert.equal((schema.offers as Record<string, unknown>).availability, "https://schema.org/InStock");
  assert.equal("aggregateRating" in schema, false);
  assert.equal("review" in schema, false);
});

test("JSON-LD serialization prevents script-context HTML injection", () => {
  const serialized = serializeJsonLd({ value: "</script><script>alert(1)</script>&" });
  assert.equal(serialized.includes("</script>"), false);
  assert.equal(serialized.includes("<script>"), false);
  assert.equal(serialized.includes("&"), false);
});

test("crawler isolation and sitemap source remain explicit in repository architecture", async () => {
  const fs = await import("node:fs/promises");
  const [nextConfig, robots, sitemap, adminLayout] = await Promise.all([
    fs.readFile("next.config.ts", "utf8"),
    fs.readFile("app/robots.ts", "utf8"),
    fs.readFile("app/sitemap.ts", "utf8"),
    fs.readFile("app/admin/layout.tsx", "utf8"),
  ]);
  assert.match(nextConfig, /X-Robots-Tag/);
  assert.match(nextConfig, /\/api\/:path\*/);
  assert.match(robots, /\/admin\//);
  assert.match(robots, /\/api\//);
  assert.match(robots, /sitemap\.xml/);
  assert.match(sitemap, /status: "ACTIVE"/);
  assert.match(sitemap, /updatedAt: true/);
  assert.match(sitemap, /take: SITEMAP_PAGE_SIZE/);
  assert.match(adminLayout, /index: false/);
});
