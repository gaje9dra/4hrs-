import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, isValidAdminId, readAdminJson } from "@/lib/admin/http";
import {
  getCatalogProduct, updateCatalogProduct,
  publishCatalogProduct, unpublishCatalogProduct, archiveCatalogProduct, restoreCatalogProduct,
  createCatalogVariant, updateCatalogVariant, deactivateCatalogVariant,
  addCatalogMedia, removeCatalogMedia, setCatalogPrimaryMedia,
  listVariantProviderMappings, upsertVariantProviderMapping, removeVariantProviderMapping,
  updateCatalogCategory, archiveCatalogCategory, updateCatalogCollection, archiveCatalogCollection,
} from "@/lib/admin/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function bad(message: string) { return adminJson({ error: { code: "INVALID_REQUEST", message } }, { status: 400 }); }

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const parts = await params;
    const p = parts.path;
    if (p[0] === "products" && p[1] && !p[2]) {
      if (!isValidAdminId(p[1])) return bad("Product ID is invalid.");
      const context = await requireAdmin(request, "catalog.read");
      return adminJson(await getCatalogProduct(context, p[1]));
    }
    if (p[0] === "variants" && p[1] && p[2] === "provider-mappings") {
      if (!isValidAdminId(p[1])) return bad("Variant ID is invalid.");
      const context = await requireAdmin(request, "catalog.read");
      return adminJson({ items: await listVariantProviderMappings(context, p[1]) });
    }
    return bad("Catalog resource is not supported.");
  } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const p = (await params).path;
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    if (p[0] === "products" && p[1] && p[2]) {
      if (!isValidAdminId(p[1])) return bad("Product ID is invalid.");
      const context = await requireAdmin(request, p[2] === "publish" ? "catalog.publish" : p[2] === "archive" ? "catalog.archive" : p[2] === "restore" || p[2] === "unpublish" ? "catalog.publish" : "catalog.update");
      const reason = body.reason;
      if (p[2] === "publish") return adminJson({ product: await publishCatalogProduct(context, p[1], reason) });
      if (p[2] === "unpublish") return adminJson({ product: await unpublishCatalogProduct(context, p[1], reason) });
      if (p[2] === "archive") return adminJson({ product: await archiveCatalogProduct(context, p[1], reason) });
      if (p[2] === "restore") return adminJson({ product: await restoreCatalogProduct(context, p[1], reason) });
      return bad("Unsupported product action.");
    }
    if (p[0] === "products" && p[1] === "variants") {
      const context = await requireAdmin(request, "catalog.update");
      if (typeof body.productId !== "string" || !isValidAdminId(body.productId)) return bad("Product ID is invalid.");
      return adminJson({ variant: await createCatalogVariant(context, { ...(body as never) }) }, { status: 201 });
    }
    if (p[0] === "variants" && p[1] && p[2] === "provider-mappings") {
      if (!isValidAdminId(p[1])) return bad("Variant ID is invalid.");
      const context = await requireAdmin(request, "catalog.provider_mapping.manage");
      return adminJson({ mapping: await upsertVariantProviderMapping(context, { ...(body as never), variantId: p[1] }, body.reason) }, { status: 201 });
    }
    if (p[0] === "media") {
      const context = await requireAdmin(request, "catalog.media.manage");
      return adminJson({ media: await addCatalogMedia(context, body as never) }, { status: 201 });
    }
    return bad("Catalog resource is not supported.");
  } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const p = (await params).path;
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    if (p[0] === "products" && p[1] && !p[2]) {
      if (!isValidAdminId(p[1])) return bad("Product ID is invalid.");
      const context = await requireAdmin(request, "catalog.update");
      return adminJson({ product: await updateCatalogProduct(context, { id: p[1], ...(body as never) }) });
    }
    if (p[0] === "variants" && p[1] && !p[2]) {
      if (!isValidAdminId(p[1])) return bad("Variant ID is invalid.");
      const context = await requireAdmin(request, "catalog.update");
      return adminJson({ variant: await updateCatalogVariant(context, p[1], body as never) });
    }
    if (p[0] === "categories" && p[1]) {
      if (!isValidAdminId(p[1])) return bad("Category ID is invalid.");
      const context = await requireAdmin(request, "catalog.category.manage");
      return adminJson({ category: await updateCatalogCategory(context, p[1], body as never) });
    }
    if (p[0] === "collections" && p[1]) {
      if (!isValidAdminId(p[1])) return bad("Collection ID is invalid.");
      const context = await requireAdmin(request, "catalog.collection.manage");
      return adminJson({ collection: await updateCatalogCollection(context, p[1], body as never) });
    }
    return bad("Catalog resource is not supported.");
  } catch (error) { return adminErrorResponse(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const p = (await params).path;
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    if (p[0] === "variants" && p[1]) {
      if (!isValidAdminId(p[1])) return bad("Variant ID is invalid.");
      const context = await requireAdmin(request, "catalog.update");
      return adminJson({ variant: await deactivateCatalogVariant(context, p[1], body.reason) });
    }
    if (p[0] === "media" && p[1]) {
      if (!isValidAdminId(p[1])) return bad("Media ID is invalid.");
      const context = await requireAdmin(request, "catalog.media.manage");
      return adminJson({ media: await removeCatalogMedia(context, p[1], body.reason) });
    }
    if (p[0] === "categories" && p[1] && p[2] === "archive") {
      if (!isValidAdminId(p[1])) return bad("Category ID is invalid.");
      const context = await requireAdmin(request, "catalog.category.manage");
      return adminJson({ category: await archiveCatalogCategory(context, p[1], body.reason) });
    }
    if (p[0] === "collections" && p[1] && p[2] === "archive") {
      if (!isValidAdminId(p[1])) return bad("Collection ID is invalid.");
      const context = await requireAdmin(request, "catalog.collection.manage");
      return adminJson({ collection: await archiveCatalogCollection(context, p[1], body.reason) });
    }
    if (p[0] === "media" && p[1] && p[2] === "primary") {
      if (!isValidAdminId(p[1])) return bad("Media ID is invalid.");
      const context = await requireAdmin(request, "catalog.media.manage");
      return adminJson({ media: await setCatalogPrimaryMedia(context, p[1]) });
    }
    if (p[0] === "variants" && p[1] && p[2] === "provider-mappings" && p[3]) {
      if (!isValidAdminId(p[1])) return bad("Variant ID is invalid.");
      const context = await requireAdmin(request, "catalog.provider_mapping.manage");
      return adminJson({ mapping: await removeVariantProviderMapping(context, p[1], p[3], body.reason) });
    }
    return bad("Catalog resource is not supported.");
  } catch (error) { return adminErrorResponse(error); }
}
