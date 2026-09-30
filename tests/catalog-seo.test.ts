import test from "node:test";
import { Prisma } from "@prisma/client";
import assert from "node:assert/strict";
import {
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
  slugify,
  validateSeoMetadata,
} from "../lib/catalog/validation.ts";
import {
  categoryCanonicalUrl,
  categoryPath,
  collectionCanonicalUrl,
  collectionPath,
  productCanonicalUrl,
  productPath,
} from "../lib/catalog/routes.ts";
import {
  getCategoryIndexability,
  getCollectionIndexability,
  getProductIndexability,
  getPublicCatalogSeoMetadata,
  getPublicProductSeoMetadata,
} from "../lib/catalog/seo.ts";

const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

test.after(() => {
  if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
});

test("slug generation is deterministic, URL-safe, normalized, and handles Unicode", () => {
  assert.equal(slugify("  Summer   T-Shirt! "), "summer-t-shirt");
  assert.equal(slugify("Café / New Drop"), "cafe-new-drop");
  assert.equal(slugify("RED---SHIRT"), "red-shirt");

  const unicodeA = slugify("红色衬衫");
  const unicodeB = slugify("红色衬衫");
  assert.equal(unicodeA, unicodeB);
  assert.match(unicodeA, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test("SEO field validation normalizes empty values and rejects only oversized metadata", () => {
  assert.deepEqual(validateSeoMetadata({ seoTitle: "   ", seoDescription: "" }), []);
  assert.deepEqual(validateSeoMetadata({ seoTitle: "A".repeat(SEO_TITLE_MAX_LENGTH) }), []);
  assert.deepEqual(validateSeoMetadata({ seoDescription: "A".repeat(SEO_DESCRIPTION_MAX_LENGTH) }), []);

  assert.equal(validateSeoMetadata({ seoTitle: "A".repeat(SEO_TITLE_MAX_LENGTH + 1) })[0]?.code, "SEO_TITLE_TOO_LONG");
  assert.equal(validateSeoMetadata({ seoDescription: "A".repeat(SEO_DESCRIPTION_MAX_LENGTH + 1) })[0]?.code, "SEO_DESCRIPTION_TOO_LONG");
});

test("catalog route helpers centralize canonical paths", () => {
  const product = { slug: "graphic-shirt" };
  const category = { slug: "t-shirts" };
  const collection = { slug: "new-arrivals" };

  assert.equal(productPath(product), "/product/graphic-shirt");
  assert.equal(categoryPath(category), "/category/t-shirts");
  assert.equal(collectionPath(collection), "/collection/new-arrivals");

  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com/";
  assert.equal(productCanonicalUrl(product), "https://shop.example.com/product/graphic-shirt");
  assert.equal(categoryCanonicalUrl(category), "https://shop.example.com/category/t-shirts");
  assert.equal(collectionCanonicalUrl(collection), "https://shop.example.com/collection/new-arrivals");
});

test("canonical URL configuration rejects malformed or unsafe base URLs", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "not-a-url";
  assert.throws(() => productCanonicalUrl({ slug: "shirt" }), /absolute HTTP(S) URL/);

  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com/?secret=1";
  assert.throws(() => productCanonicalUrl({ slug: "shirt" }), /query parameters/);

  process.env.NEXT_PUBLIC_SITE_URL = "javascript:alert(1)";
  assert.throws(() => productCanonicalUrl({ slug: "shirt" }), /HTTP or HTTPS/);
});

test("published product SEO uses custom metadata and canonical slug URL", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com";

  const product = {
    id: "product-1",
    title: "Graphic Shirt",
    slug: "graphic-shirt",
    shortDescription: "A short canonical product description.",
    description: "Longer product description.",
    status: "ACTIVE" as const,
    price: "999.00",
    compareAtPrice: "1299.00",
    currency: "INR",
    seoTitle: "Custom Graphic Shirt | 4HRS",
    seoDescription: "Custom search description.",
  };

  const metadata = getPublicProductSeoMetadata(product);
  assert.deepEqual(metadata, {
    title: "Custom Graphic Shirt | 4HRS",
    description: "Custom search description.",
    canonicalUrl: "https://shop.example.com/product/graphic-shirt",
    indexable: true,
    robots: "index,follow",
  });
});

test("SEO fallback derives metadata at runtime without duplicating generated values", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com";

  const metadata = getPublicCatalogSeoMetadata({
    type: "product",
    entity: {
      title: "Minimal Tee",
      slug: "minimal-tee",
      shortDescription: "Minimal everyday tee.",
      description: "Full description.",
      status: "ACTIVE",
      price: "799.00",
      currency: "INR",
      seoTitle: null,
      seoDescription: null,
    },
  });

  assert.equal(metadata?.title, "Minimal Tee");
  assert.equal(metadata?.description, "Minimal everyday tee.");
  assert.equal(metadata?.canonicalUrl, "https://shop.example.com/product/minimal-tee");
});

test("unpublished or invalid products are not exposed through the public SEO contract", () => {
  const base = {
    id: "product-3",
    title: "Draft Tee",
    slug: "draft-tee",
    description: "Draft description.",
    status: "DRAFT" as const,
    price: "799.00",
    currency: "INR",
    seoTitle: "Private title",
    seoDescription: "Private description",
  };

  assert.equal(getProductIndexability(base).indexable, false);
  assert.equal(getPublicProductSeoMetadata(base), null);

  const invalidActive = { ...base, status: "ACTIVE" as const, currency: "bad" };
  assert.equal(getProductIndexability(invalidActive).reason, "INVALID");
  assert.equal(getPublicProductSeoMetadata(invalidActive), null);
});

test("category and collection SEO follow their own active lifecycle and canonical paths", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com";

  const category = {
    id: "category-1",
    name: "T-Shirts",
    slug: "t-shirts",
    description: "Browse t-shirts.",
    status: "ACTIVE" as const,
    parentId: null,
    seoTitle: null,
    seoDescription: null,
  };
  const collection = {
    id: "collection-1",
    name: "New Arrivals",
    slug: "new-arrivals",
    description: "Latest products.",
    status: "ACTIVE" as const,
    seoTitle: null,
    seoDescription: null,
  };

  assert.equal(getCategoryIndexability(category).indexable, true);
  assert.equal(getCollectionIndexability(collection).indexable, true);

  const archivedCategory = { ...category, status: "ARCHIVED" as const };
  assert.equal(getCategoryIndexability(archivedCategory).indexable, false);

  const categoryMetadata = getPublicCatalogSeoMetadata({ type: "category", entity: category });
  const collectionMetadata = getPublicCatalogSeoMetadata({ type: "collection", entity: collection });
  assert.equal(categoryMetadata?.canonicalUrl, "https://shop.example.com/category/t-shirts");
  assert.equal(collectionMetadata?.canonicalUrl, "https://shop.example.com/collection/new-arrivals");
});

test("provider-neutral SEO identity is identical for manually created and imported products", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com";

  const manual = {
    id: "manual-1",
    title: "Provider Neutral Tee",
    slug: "provider-neutral-tee",
    description: "Canonical description.",
    status: "ACTIVE" as const,
    price: "999.00",
    currency: "INR",
    seoTitle: null,
    seoDescription: null,
  };
  const imported = {
    ...manual,
    id: "imported-1",
  };

  assert.deepEqual(
    getPublicProductSeoMetadata(manual),
    getPublicProductSeoMetadata(imported),
  );
});

test("search and SEO use the same canonical product slug identity", () => {
  const searchResult = { id: "product-9", slug: "same-canonical-product" };
  assert.equal(productPath(searchResult), "/product/same-canonical-product");
});

test("published slug changes are rejected until a redirect strategy exists", async () => {
  const { createCatalogService } = await import("../lib/catalog/service.ts");

  const product = {
    id: "product-10",
    title: "Published Tee",
    slug: "published-tee",
    description: null,
    shortDescription: null,
    status: "ACTIVE" as const,
    price: new Prisma.Decimal("999.00"),
    compareAtPrice: null,
    currency: "INR",
    seoTitle: null,
    seoDescription: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const service = createCatalogService({
    getProductById: async () => product,
    getProductBySlug: async () => null,
  });

  await assert.rejects(
    service.updateProduct({
      id: product.id,
      slug: "renamed-published-tee",
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes("Published Product slugs cannot change"),
  );
});

test("application-level slug uniqueness is checked before category and collection writes", async () => {
  const { createCatalogService } = await import("../lib/catalog/service.ts");

  const categoryService = createCatalogService({
    getCategoryBySlug: async () => ({ id: "other-category", name: "Other", slug: "other-category", description: null, seoTitle: null, seoDescription: null, parentId: null, status: "ACTIVE" as const, createdAt: new Date(), updatedAt: new Date(), _count: { products: 0 } }),
  });
  await assert.rejects(
    categoryService.createCategory({
      name: "T-Shirts",
      slug: "t-shirts",
      status: "ACTIVE",
    }),
    (error: unknown) => error instanceof Error && error.message.includes("Catalog slug already exists"),
  );

  const collectionService = createCatalogService({
    getCollectionBySlug: async () => ({ id: "other-collection", name: "Other", slug: "other-collection", description: null, seoTitle: null, seoDescription: null, status: "ACTIVE" as const, createdAt: new Date(), updatedAt: new Date(), _count: { products: 0 } }),
  });
  await assert.rejects(
    collectionService.createCollection({
      name: "New Arrivals",
      slug: "new-arrivals",
      status: "ACTIVE",
    }),
    (error: unknown) => error instanceof Error && error.message.includes("Catalog slug already exists"),
  );
});
