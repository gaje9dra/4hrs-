import { assertSameOrigin, authErrorResponse } from "@/lib/auth/http";
import { requireAdmin } from "@/lib/auth/admin";
import { createCatalogService } from "@/lib/catalog/service";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { AuthenticationError } from "@/lib/auth/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const catalog = createCatalogService();

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function errorResponse(error: unknown) {
  if (error instanceof CatalogServiceError) return json({ error: error.message }, 400);
  if (error instanceof AuthenticationError) return authErrorResponse(error);
  return json({ error: "Catalog operation failed." }, 500);
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request,"catalog.update");
    assertSameOrigin(request);
    const input = await request.json();
    const variant = await catalog.createVariant(input);
    return json({ variant }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request,"catalog.update");
    assertSameOrigin(request);
    const input = await request.json();
    if (!input || typeof input !== "object" || typeof input.id !== "string") return json({ error: "Variant ID is required." }, 400);
    const variant = await catalog.updateVariant(input.id, input);
    return json({ variant });
  } catch (error) {
    return errorResponse(error);
  }
}
