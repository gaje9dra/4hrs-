import { requireAdmin } from "@/lib/auth/admin";
import { adminErrorResponse } from "@/lib/admin/http";import { AdminError } from "@/lib/admin/errors";import { createCatalogService } from "@/lib/catalog/service";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { authErrorResponse } from "@/lib/auth/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const catalog = createCatalogService();

export async function GET(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    await requireAdmin(request,"catalog.read");
    const { productId } = await context.params;
    return Response.json({ product: await catalog.getProductDetails(productId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CatalogServiceError) return Response.json({ error: error.message }, { status: 400 });
    return authErrorResponse(error);
  }
}
