import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
import { isValidAdminId } from "@/lib/admin/http";
import { createCatalogProduct, createCatalogCategory, createCatalogCollection, listCatalogProducts, listCatalogCategories, listCatalogCollections } from "@/lib/admin/catalog";
import type { CatalogSortField, SortDirection } from "@/lib/catalog/repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseIntParam(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) throw new Error("INVALID_PAGINATION");
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error("INVALID_PAGINATION");
  return parsed;
}

function parseCatalogOptions(request: Request) {
  const q = new URL(request.url).searchParams;
  const sortByRaw = q.get("sortBy") ?? "createdAt";
  const sortBy = ["createdAt","updatedAt","title","price"].includes(sortByRaw) ? sortByRaw as CatalogSortField : (() => { throw new Error("INVALID_SORT"); })();
  const sortDirectionRaw = q.get("sortDirection") ?? "desc";
  const sortDirection = sortDirectionRaw === "asc" || sortDirectionRaw === "desc" ? sortDirectionRaw as SortDirection : (() => { throw new Error("INVALID_SORT"); })();
  const status = q.get("status");
  if (status !== null && !["DRAFT","ACTIVE","ARCHIVED"].includes(status)) throw new Error("INVALID_FILTER");
  const limit = parseIntParam(q.get("limit"), 24, 1, 100);
  const page = parseIntParam(q.get("page"), 1, 1, 1000000);
  const offset = (page - 1) * limit;
  return {
    filters: {
      ...(q.get("search") ? { search: q.get("search")!.trim() } : {}),
      ...(status ? { status: status as "DRAFT" | "ACTIVE" | "ARCHIVED" } : {}),
      ...(q.get("categoryId") ? { categoryId: q.get("categoryId")! } : {}),
      ...(q.get("collectionId") ? { collectionId: q.get("collectionId")! } : {}),
      ...(q.get("tagId") ? { tagId: q.get("tagId")! } : {}),
      ...(q.get("minPrice") ? { minPrice: q.get("minPrice")! } : {}),
      ...(q.get("maxPrice") ? { maxPrice: q.get("maxPrice")! } : {}),
    },
    sortBy, sortDirection, limit, offset,
  };
}

function badRequest(message: string) { return adminJson({ error: { code: "INVALID_REQUEST", message } }, { status: 400 }); }

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const resource = q.get("resource") ?? "products";
    if (resource === "products") {
      const context = await requireAdmin(request, "catalog.read");
      return adminJson(await listCatalogProducts(context, parseCatalogOptions(request)));
    }
    if (resource === "categories") {
      const context = await requireAdmin(request, "catalog.category.manage");
      return adminJson({ items: await listCatalogCategories(context) });
    }
    if (resource === "collections") {
      const context = await requireAdmin(request, "catalog.collection.manage");
      return adminJson({ items: await listCatalogCollections(context) });
    }
    return badRequest("Unsupported catalog resource.");
  } catch (error) {
    if (error instanceof Error && ["INVALID_PAGINATION","INVALID_SORT","INVALID_FILTER"].includes(error.message)) return badRequest("Catalog query parameters are invalid.");
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const resource = q.get("resource") ?? "products";
    const context = await requireAdmin(request, resource === "categories" ? "catalog.category.manage" : resource === "collections" ? "catalog.collection.manage" : "catalog.create");
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    if (resource === "categories") return adminJson({ category: await createCatalogCategory(context, body as never) }, { status: 201 });
    if (resource === "collections") return adminJson({ collection: await createCatalogCollection(context, body as never) }, { status: 201 });
    return adminJson({ product: await createCatalogProduct(context, body as never) }, { status: 201 });
  } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireAdmin(request, "catalog.update");
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    if (typeof body.id !== "string" || !isValidAdminId(body.id)) return badRequest("Product ID is invalid.");
    const { id, ...patch } = body;
    return adminJson({ product: await import("@/lib/admin/catalog").then((m) => m.updateCatalogProduct(context, { id, ...(patch as never) })) });
  } catch (error) { return adminErrorResponse(error); }
}
