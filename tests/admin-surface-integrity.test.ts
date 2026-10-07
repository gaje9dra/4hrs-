import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ADMIN_PERMISSIONS } from "@/lib/admin/permissions";

function filesUnder(root: string, suffix: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && path.endsWith(suffix)) out.push(path);
    }
  }
  walk(root);
  return out;
}

function routeFromPagePath(path: string): string {
  const root = join(process.cwd(), "app");
  let value = relative(root, path).replaceAll("\\", "/").replace(/\/page\.tsx$/, "");
  value = value.replace(/^\([^/]+\)\//, "");
  value = value.replace(/\/\[[^/]+\]/g, "");
  return "/" + value.replace(/^admin\//, "admin/");
}

test("every admin page is protected by the centralized authorization boundary", () => {
  const pages = filesUnder(join(process.cwd(), "app", "admin"), "page.tsx");
  assert.ok(pages.length > 20, "admin page inventory unexpectedly shrank");
  for (const file of pages) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /requireAdmin\(/, relative(process.cwd(), file));
  }
});

test("every admin API route is protected by centralized RBAC", () => {
  const routes = filesUnder(join(process.cwd(), "app", "api", "admin"), "route.ts");
  assert.ok(routes.length > 50, "admin API inventory unexpectedly shrank");
  for (const file of routes) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /requireAdmin\(/, relative(process.cwd(), file));
  }
});

test("admin navigation targets existing pages and uses declared permission keys", () => {
  const layout = readFileSync(join(process.cwd(), "app", "admin", "layout.tsx"), "utf8");
  const hrefs = [...layout.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
  const permissions = [...layout.matchAll(/permission: "([^"]+)"/g)].map((m) => m[1]);

  assert.ok(hrefs.includes("/admin/fulfillments"));
  assert.ok(!hrefs.includes("/admin/fulfillment"));
  assert.ok(hrefs.includes("/admin/returns"));

  for (const permission of permissions) {
    assert.ok((ADMIN_PERMISSIONS as readonly string[]).includes(permission), permission);
  }

  for (const href of hrefs.filter((value) => value.startsWith("/admin/"))) {
    const segments = href.slice("/admin/".length).split("/").filter(Boolean);
    let candidate = join(process.cwd(), "app", "admin", ...segments, "page.tsx");
    if (!statSyncSafe(candidate)) {
      candidate = join(process.cwd(), "app", "admin", ...segments, "page.tsx");
    }
    assert.ok(statSyncSafe(candidate), `navigation target is missing: ${href}`);
  }
});

function statSyncSafe(path: string): boolean {
  try { return statSync(path).isFile(); } catch { return false; }
}

test("admin dashboard does not advertise stale or nonexistent control-plane routes", () => {
  const dashboard = readFileSync(join(process.cwd(), "app", "admin", "page.tsx"), "utf8");
  assert.match(dashboard, /href:"\/admin\/fulfillments"/);
  assert.doesNotMatch(dashboard, /href:"\/admin\/fulfillment"/);
  assert.match(dashboard, /permission:"return\.read"/);
  assert.doesNotMatch(dashboard, /permission:"returns\.read"/);
  assert.match(dashboard, /href:"\/admin\/deployments"/);
  assert.match(dashboard, /href:"\/admin\/resilience"/);
});


test("admin product creation submits and defaults to draft status", () => {
  const route = readFileSync(join(process.cwd(), "app", "api", "admin", "catalog", "route.ts"), "utf8");
  const form = readFileSync(join(process.cwd(), "components", "admin", "catalog", "catalog-product-form.tsx"), "utf8");
  assert.match(route, /body\.status === undefined\) body\.status = "DRAFT"/);
  assert.match(route, /catch \(error\) \{ return adminCatalogErrorResponse\(error\); \}/);
  assert.match(form, /name="status" value="DRAFT"/);
});


test("admin catalog serializer handles Prisma Decimal values", () => {
  const source = readFileSync(join(process.cwd(), "lib", "admin", "catalog.ts"), "utf8");
  assert.match(source, /Prisma\.Decimal\.isDecimal\(value\)/);
  assert.doesNotMatch(source, /value\.constructor\?\.name === "Decimal"/);
});


test("catalog publishing revalidates storefront listing routes", () => {
  const source = readFileSync(join(process.cwd(), "app", "api", "admin", "catalog", "[...path]", "route.ts"), "utf8");
  assert.match(source, /revalidatePath\("\/"\)/);
  assert.match(source, /revalidatePath\("\/shop"\)/);
});

test("catalog image uploads use a file input and server-side size/type validation", () => {
  const component = readFileSync(join(process.cwd(), "components", "admin", "catalog", "catalog-media-manager.tsx"), "utf8");
  const route = readFileSync(join(process.cwd(), "app", "api", "admin", "catalog", "images", "upload", "route.ts"), "utf8");
  assert.match(component, /type="file"/);
  assert.match(component, /\/api\/admin\/catalog\/images\/upload/);
  assert.match(route, /MAX_IMAGE_BYTES = 4 \* 1024 \* 1024/);
  assert.match(route, /ALLOWED_IMAGE_TYPES/);
  assert.match(route, /file\.size > MAX_IMAGE_BYTES/);
  assert.match(route, /storageReference = "inline-db:"/);
});


test("catalog publish route preserves catalog readiness errors", () => {
  const route = readFileSync(join(process.cwd(), "app", "api", "admin", "catalog", "[...path]", "route.ts"), "utf8");
  const http = readFileSync(join(process.cwd(), "lib", "admin", "http.ts"), "utf8");
  const action = readFileSync(join(process.cwd(), "components", "admin", "catalog", "catalog-action.tsx"), "utf8");
  const service = readFileSync(join(process.cwd(), "lib", "catalog", "service.ts"), "utf8");
  assert.match(route, /catch \(error\) \{ return adminCatalogErrorResponse\(error\); \}/);
  assert.match(http, /error\.code === "NOT_PUBLICATION_READY"/);
  assert.match(http, /const details = error\.code === "NOT_PUBLICATION_READY"/);
  assert.match(action, /error\.details\?\.issues/);
  assert.match(service, /MISSING_QIKINK_MAPPING/);
});
