import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const routes = [
  ["refund-replacement", "Refund & Replacement Policy"],
  ["shipping", "Shipping & Delivery Policy"],
  ["terms", "Terms & Conditions"],
  ["privacy", "Privacy Policy"],
  ["cancellation", "Cancellation Policy"],
  ["contact", "Contact Us"],
  ["faq", "Frequently Asked Questions"],
] as const;

test("all Phase 17.2 public policy routes exist and provide route-specific metadata", () => {
  for (const [slug] of routes) {
    const route = read(`app/(storefront)/${slug}/page.tsx`);
    assert.match(route, new RegExp(`PolicyPage slug="${slug}"`));
    assert.match(route, new RegExp(`policyMetadata\("${slug}"\)`));
  }
  const page = read("components/storefront/policy-page.tsx");
  assert.match(page, /alternates:\s*\{\s*canonical/);
  assert.match(page, /openGraph:/);
  assert.match(page, /aria-labelledby/);
  assert.match(page, /Related policy pages/);
});

test("refund and replacement policy preserves the defect-only standard without extinguishing statutory rights", () => {
  const content = read("lib/policies/content.ts");
  assert.match(content, /Refund & Replacement Policy/);
  assert.match(content, /within 24 hours of receiving the order/);
  assert.match(content, /continuous, unedited unboxing video/);
  assert.match(content, /absence of a video is not, by itself, a universal legal basis/);
  assert.match(content, /late report is not automatically rejected/);
  assert.match(content, /mandatory consumer rights/);
  assert.match(content, /change of mind, an incorrect size selection/);
  assert.match(content, /does not automatically issue a refund or create a replacement order/);
});

test("policy pages do not fabricate contact details, processing deadlines, or delivery promises", () => {
  const content = read("lib/policies/content.ts");
  assert.match(content, /No public support email, telephone number, or return address is currently configured/);
  assert.match(content, /do not publish a fixed processing deadline/);
  assert.match(content, /do not publish a universal dispatch or delivery deadline/);
  assert.doesNotMatch(content, /support@4hrs\.(com|store|in)|\+91[ -]?\d{10}/i);
});

test("privacy policy describes real data categories, provider sharing and existing self-service controls", () => {
  const content = read("lib/policies/content.ts");
  assert.match(content, /account\/session information/);
  assert.match(content, /order items, selected sizes\/variants/);
  assert.match(content, /PayU where configured/);
  assert.match(content, /Qikink where applicable/);
  assert.match(content, /account deletion\/anonymization controls/);
  assert.match(content, /no system can promise absolute security/);
});

test("all policy pages are linked from the footer and included in the existing sitemap", () => {
  const footer = read("config/footer.ts");
  const sitemap = read("app/sitemap.ts");
  for (const [slug] of routes) {
    assert.match(footer, new RegExp(`href: '/${slug}'`));
    assert.match(sitemap, new RegExp(`["']${slug}["']`));
  }
});

test("defect claims reuse existing support cases and do not introduce unsafe public evidence uploads", () => {
  const page = read("app/(storefront)/account/cases/new/page.tsx");
  const api = read("app/api/cases/route.ts");
  const policy = read("lib/policies/content.ts");
  assert.match(page, /ORDER_ISSUE/);
  assert.match(page, /RETURN_REVIEW/);
  assert.match(api, /createCustomerCase/);
  assert.match(policy, /current support-case form does not provide a secure video or photo upload field/);
  assert.match(policy, /does not automatically issue a refund or create a replacement order/);
});
