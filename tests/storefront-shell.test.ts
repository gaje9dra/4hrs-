import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("root shell wraps storefront content with skip link, main and footer", () => {
  const source = read("app/layout.tsx");
  assert.match(source, /<SkipLink \/>/);
  assert.match(source, /<Header items=\{navigation\} \/>/);
  assert.match(source, /<main id="main-content"/);
  assert.match(source, /<Footer navigationGroups=\{footerGroups\} \/>/);
});

test("storefront navigation uses the public catalog service and canonical routes", () => {
  const source = read("lib/storefront/navigation.ts");
  assert.match(source, /createCatalogQueryService/);
  assert.match(source, /listActiveCategories/);
  assert.match(source, /listActiveCollections/);
  assert.match(source, /categoryPath/);
  assert.match(source, /collectionPath/);
  assert.doesNotMatch(source, /PrismaClient|provider|qikink|printful|printrove|printify/i);
});

test("global navigation contains only implemented storefront destinations", () => {
  const source = read("lib/storefront/navigation.ts");
  for (const href of ["/", "/shop", "/search"]) assert.match(source, new RegExp(href.replace("/", "\/")));
  assert.match(source, /Categories/);
  assert.match(source, /Collections/);
  assert.doesNotMatch(source, /\/cart/);
  assert.doesNotMatch(source, /\/wishlist|\/account|\/checkout|\/orders/i);
});

test("desktop and mobile navigation expose route-aware active states", () => {
  const desktop = read("components/layout/desktop-nav.tsx");
  const mobile = read("components/layout/mobile-nav.tsx");
  for (const source of [desktop, mobile]) {
    assert.match(source, /aria-current/);
    assert.match(source, /activePrefixes/);
    assert.match(source, /pathname/);
  }
});

test("mobile navigation implements Escape, focus return and focus containment", () => {
  const source = read("components/layout/mobile-nav.tsx");
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /trigger\?\.focus\(\)/);
  assert.match(source, /querySelectorAll<HTMLElement>/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /document\.body\.style\.overflow/);
});

test("search is a canonical storefront navigation entry without a search engine implementation", () => {
  const navigation = read("lib/storefront/navigation.ts");
  const header = read("components/layout/header.tsx");
  assert.match(navigation, /href: "\/search"/);
  assert.doesNotMatch(header, /Algolia|Elasticsearch|Meilisearch|Typesense|OpenSearch/i);
});

test("footer navigation is derived from public catalog navigation", () => {
  const source = read("lib/storefront/navigation.ts");
  assert.match(source, /storefrontNavigationToFooterGroups/);
  assert.match(source, /label: "Categories"/);
  assert.match(source, /label: "Collections"/);
  assert.doesNotMatch(source, /admin|provider/i);
});

test("storefront shell integrates customer authentication without admin navigation", () => {
  const source = read("components/layout/header.tsx");
  const authStatus = read("components/storefront/customer-auth-status.tsx");
  assert.match(source, /CustomerAuthStatus/);
  assert.match(authStatus, /\/api\/auth\/session/);
  assert.match(authStatus, /href="\/cart"/);\n  assert.match(authStatus, /UserRound/);\n  assert.match(authStatus, /ShoppingCart/);\n  assert.doesNotMatch(authStatus, /customer\\.email|Sign out|LogOut/);
  assert.doesNotMatch(authStatus, /admin|passwordHash|sessionToken/i);
});

test("storefront shell preserves the established Bauhaus token system", () => {
  const source = read("app/globals.css");
  assert.match(source, /--background: #F0F0F0/);
  assert.match(source, /--primary-red: #D02020/);
  assert.match(source, /--primary-blue: #1040C0/);
  assert.match(source, /--primary-yellow: #F0C020/);
  assert.match(source, /--shadow-md: 6px 6px 0 #121212/);
  assert.doesNotMatch(source, /backdrop-filter|linear-gradient|glassmorphism/i);
});
