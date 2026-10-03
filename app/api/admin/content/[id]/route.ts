import { assertSameOrigin, authErrorResponse } from "@/lib/auth/http";
import { adminErrorResponse } from "@/lib/admin/http";
import { AdminError } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/admin/authorization";
import { ContentError, getContent, getContentPreview, updateContent, type ContentInput } from "@/lib/content/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAdmin(request, "content.read");
    const id = (await params).id;
    const content = await getContent(id);
    if (!content) return json({ error: { code: "NOT_FOUND", message: "Content was not found." } }, 404);
    return json({ content, canPreview: context.permissions.has("content.preview") });
  } catch (error) {
    if (error instanceof AdminError) return adminErrorResponse(error);
    return authErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAdmin(request, "content.update");
    assertSameOrigin(request);
    const id = (await params).id;
    const body = await request.json() as { expectedVersion?: unknown; input?: ContentInput; changeSummary?: unknown };
    const expectedVersion = typeof body.expectedVersion === "number" && Number.isInteger(body.expectedVersion) ? body.expectedVersion : null;
    if (expectedVersion === null || !body.input) return json({ error: { code: "INVALID_REQUEST", message: "expectedVersion and input are required." } }, 400);
    const changeSummary = typeof body.changeSummary === "string" ? body.changeSummary : null;
    return json({ content: await updateContent(context, id, expectedVersion, body.input, changeSummary) });
  } catch (error) {
    if (error instanceof AdminError) return adminErrorResponse(error);
    if (error instanceof ContentError) return json({ error: { code: error.code, message: error.message, details: error.details } }, error.code === "CONFLICT" ? 409 : 400);
    return authErrorResponse(error);
  }
}