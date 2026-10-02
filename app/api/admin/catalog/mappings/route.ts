import { assertSameOrigin, authErrorResponse } from "@/lib/auth/http";
import { requireAdmin } from "@/lib/auth/admin";
import { AuthenticationError } from "@/lib/auth/errors";
import { createProviderMappingService } from "@/lib/fulfillment/mapping-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const mappings = createProviderMappingService();

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationError) return authErrorResponse(error);
  return json({ error: error instanceof Error ? error.message : "Provider mapping operation failed." }, 400);
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const variantId = new URL(request.url).searchParams.get("variantId")?.trim();
    if (!variantId) return json({ error: "variantId is required." }, 400);
    return json({ mappings: await mappings.getVariantMappings(variantId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    assertSameOrigin(request);
    const input = await request.json();
    const mapping = await mappings.saveVariantMapping(input);
    return json({ mapping }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    assertSameOrigin(request);
    const input = await request.json();
    if (!input?.variantId || !input?.providerId) return json({ error: "variantId and providerId are required." }, 400);
    await mappings.removeVariantMapping(input.variantId, input.providerId);
    return json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
