import assert from "node:assert/strict";
import test from "node:test";
import { validateContentInput, type ContentInput } from "@/lib/content/service";

function base(overrides: Partial<ContentInput> = {}): ContentInput {
  return {
    type: "LANDING_PAGE", internalName: "Launch page", slug: "launch-page", locale: "en-IN",
    title: "Launch", summary: "A launch page.", body: [{ type: "paragraph", text: "Hello." }],
    seoTitle: "Launch", seoDescription: "Launch page", canonicalUrl: "/content/launch-page",
    robots: "index,follow", openGraphTitle: "Launch", openGraphDescription: "Launch page",
    mediaReferences: [], linkedReferences: [], publicationStartAt: null, publicationEndAt: null,
    translationStatus: "ORIGINAL", sourceContentId: null, sourceVersion: null, ...overrides,
  };
}

test("Phase 15.13 accepts strict structured editorial blocks", () => {
  const snapshot = validateContentInput(base({
    body: [
      { type: "heading", level: 2, text: "New edit" },
      { type: "paragraph", text: "Safe structured content." },
      { type: "link", label: "Shop", href: "/shop" },
      { type: "cta", label: "External", href: "https://example.com/offer" },
    ],
  }));
  assert.equal(snapshot.body.length, 4);
});

test("Phase 15.13 rejects unsafe rich-content URLs", () => {
  assert.throws(() => validateContentInput(base({
    body: [{ type: "link", label: "XSS", href: "javascript:alert(1)" }],
  })));
  assert.throws(() => validateContentInput(base({
    body: [{ type: "link", label: "Bad", href: "//attacker.example" }],
  })));
});

test("Phase 15.13 requires publication slugs and typed catalog references", () => {
  assert.throws(() => validateContentInput(base({ slug: null })));
  assert.throws(() => validateContentInput(base({ type: "PRODUCT_EDITORIAL", slug: null })));
  assert.throws(() => validateContentInput(base({
    type: "PRODUCT_EDITORIAL", linkedReferences: [{ type: "PRODUCT", id: "product-1" }],
  })));
});

test("Phase 15.13 rejects oversized or malformed block payloads", () => {
  assert.throws(() => validateContentInput(base({
    body: Array.from({ length: 101 }, () => ({ type: "paragraph", text: "x" })),
  })));
  assert.throws(() => validateContentInput(base({
    body: [{ type: "unknown", value: "unsafe" } as unknown as ContentInput["body"][number]],
  })));
});

test("Phase 15.13 requires explicit locale and safe SEO directives", () => {
  assert.throws(() => validateContentInput(base({ locale: "fr-FR" })));
  assert.throws(() => validateContentInput(base({ robots: "index,follow,noarchive" })));
});
