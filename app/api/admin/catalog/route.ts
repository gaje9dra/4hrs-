import { assertSameOrigin, authErrorResponse } from "@/lib/auth/http";
import { requireAdmin } from "@/lib/auth/admin";
import { createCatalogService } from "@/lib/catalog/service";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { AuthenticationError } from "@/lib/auth/errors";
import { AdminError } from "@/lib/admin/errors";
import { adminErrorResponse } from "@/lib/admin/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const catalog = createCatalogService();

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function errorResponse(error: unknown) {
  if (error instanceof CatalogServiceError) return json({ error: { code: "CATALOG_REQUEST_INVALID", message: error.message } }, 400);
  if (error instanceof AdminError) return adminErrorResponse(error);
  if (error instanceof AuthenticationError) return authErrorResponse(error);
  return json({ error: { code: "CATALOG_OPERATION_FAILED", message: "Catalog operation failed safely." } }, 500);
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "catalog.read");
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status = rawStatus === "DRAFT" || rawStatus === "ACTIVE" || rawStatus === "ARCHIVED" ? rawStatus : undefined;
    const result = await catalog.listProducts({ filters: { status }, limit: 100, offset: 0 });
    const items = (await Promise.all(result.items.map((item) => item ? catalog.getProductWithVariants(item.id) : null))).filter((item): item is NonNullable<typeof item> => item !== null);
    return json({ ...result, items });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request, "catalog.create");
    assertSameOrigin(request);
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: { code: "INVALID_REQUEST", message: "Invalid catalog request." } }, 400);
    const product = await catalog.createProduct(input);
    return json({ product }, 201);
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request, "catalog.update");
    assertSameOrigin(request);
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input) || typeof input.id !== "string" || !input.id.trim()) return json({ error: { code: "INVALID_REQUEST", message: "Product ID is required." } }, 400);
    const product = await catalog.updateProduct(input.id, input);
    return json({ product });
  } catch (error) { return errorResponse(error); }
}
