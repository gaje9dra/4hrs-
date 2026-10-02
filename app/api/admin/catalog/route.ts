import { assertSameOrigin } from "@/lib/auth/http";
import { requireAdmin } from "@/lib/auth/admin";
import { createCatalogService } from "@/lib/catalog/service";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { authErrorResponse } from "@/lib/auth/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const catalog = createCatalogService();

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function errorResponse(error: unknown) {
  if (error instanceof CatalogServiceError) return json({ error: error.message }, 400);
  return authErrorResponse(error);
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const result = await catalog.listProducts({ filters: { status: url.searchParams.get("status") as "DRAFT" | "ACTIVE" | "ARCHIVED" | undefined }, limit: 100, offset: 0 });
    const items = await Promise.all(result.items.map((item) => catalog.getProductWithVariants(item.id)));
    return json({ ...result, items });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    assertSameOrigin(request);
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "Invalid catalog request." }, 400);
    const product = await catalog.createProduct(input);
    return json({ product }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    assertSameOrigin(request);
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input) || typeof input.id !== "string") {
      return json({ error: "Product ID is required." }, 400);
    }
    const product = await catalog.updateProduct(input);
    return json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}
