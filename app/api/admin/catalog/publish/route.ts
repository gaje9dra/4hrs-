import { assertSameOrigin, authErrorResponse } from "@/lib/auth/http";
import { requireAdmin } from "@/lib/auth/admin";
import { createCatalogService } from "@/lib/catalog/service";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { createFulfillmentProviderMappingRepository } from "@/lib/fulfillment/mapping";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const catalog = createCatalogService();
const mappingRepository = createFulfillmentProviderMappingRepository();

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    assertSameOrigin(request);
    const input = await request.json();
    const productId = typeof input?.productId === "string" ? input.productId.trim() : "";
    const action = input?.action;
    if (!productId || (action !== "publish" && action !== "unpublish")) return json({ error: "productId and a valid action are required." }, 400);

    if (action === "publish") {
      const variants = await catalog.getVariantsForProduct(productId);
      const activeVariants = variants.filter((variant) => variant.status === "ACTIVE");
      const missing = [];
      for (const variant of activeVariants) {
        const mapping = await mappingRepository.getByVariantAndProvider(variant.id, "qikink");
        if (!mapping?.active || !mapping.providerSku.trim()) missing.push(variant.sku);
      }
      if (missing.length) return json({ error: "Every active variant requires an active Qikink provider mapping before publication.", missingStoreSkus: missing }, 400);
      return json({ product: await catalog.publishProduct(productId) });
    }

    return json({ product: await catalog.unpublishProduct(productId) });
  } catch (error) {
    if (error instanceof CatalogServiceError) return json({ error: error.message }, 400);
    return authErrorResponse(error);
  }
}
