import { assertSameOrigin, authErrorResponse } from "@/lib/auth/http";
import { adminErrorResponse } from "@/lib/admin/http";import { AdminError } from "@/lib/admin/errors";import { requireAdmin } from "@/lib/auth/admin";
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
  if (error instanceof AdminError) return adminErrorResponse(error);
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

    // Size is a customer-facing option, while ProductVariant remains the canonical
    // purchasable/orderable record. Keep the option relation in sync automatically.
    if (typeof input?.size === "string" && input.size.trim()) {
      const normalizedValue = input.size.trim().replace(/\s+/g, " ").toLowerCase();
      const optionType =
        await catalog.getOptionTypeByNormalizedName("size") ??
        await catalog.createOptionType({ name: "Size", normalizedName: "size", sortOrder: 0 });
      const optionValue =
        await catalog.getOptionValueByIdentity(optionType.id, normalizedValue) ??
        await catalog.createOptionValue({
          optionTypeId: optionType.id,
          displayName: input.size.trim().replace(/\s+/g, " ").toUpperCase(),
          normalizedValue,
          sortOrder: 0,
        });
      await catalog.assignProductOptionType(input.productId, optionType.id, 0);
      await catalog.replaceVariantOptionValues(variant.id, [optionValue.id]);
    }

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
