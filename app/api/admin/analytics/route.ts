import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import { auditAdminAction } from "@/lib/admin/audit";
import { assertAdminSameOrigin } from "@/lib/admin/http";
import { getAdminAnalytics, parseAnalyticsQuery } from "@/lib/admin/analytics";
import { AdminError } from "@/lib/admin/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  let context;
  try {
    context = await requireAdmin(request, "analytics.read");
    const query = parseAnalyticsQuery(new URL(request.url));
    const financial = context.permissions.has("analytics.financial.read");
    const operations = context.permissions.has("analytics.operations.read");
    const customer = context.permissions.has("analytics.customer.read");
    const result = await getAdminAnalytics(query, { financial, operations, customer });
    if (financial || customer) {
      await auditAdminAction(context, {
        action: "ANALYTICS_ACCESS",
        resourceType: "AnalyticsReport",
        success: true,
        reason: "Sensitive analytics dashboard access",
        metadata: { from: query.from, to: query.to, timezone: query.timezone, grouping: query.grouping, financial, customer },
      });
    }
    return NextResponse.json({ analytics: result });
  } catch (error) {
    if (context) {
      await auditAdminAction(context, {
        action: "ANALYTICS_ACCESS_FAILED",
        resourceType: "AnalyticsReport",
        success: false,
        reason: "Analytics query failed",
        metadata: { error: error instanceof Error ? error.name : "unknown" },
      }).catch(() => undefined);
    }
    const code = error instanceof AdminError ? error.code : "DATABASE_ERROR";
    const status = code === "FORBIDDEN" ? 403 : code === "INVALID_REQUEST" ? 400 : 500;
    return NextResponse.json({ error: { code, message: error instanceof Error ? error.message : "Analytics query failed." } }, { status });
  }
}

export async function POST(request: Request) {
  assertAdminSameOrigin(request);
  return NextResponse.json({ error: { code: "METHOD_NOT_ALLOWED", message: "Analytics is read-only." } }, { status: 405 });
}