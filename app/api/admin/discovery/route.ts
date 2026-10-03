import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { getDiscoverySignals } from "@/lib/discovery/signals";
import { getCatalogQualityFindings } from "@/lib/discovery/catalog-quality";
import { getSearchDiagnostics } from "@/lib/discovery/search-diagnostics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "discovery.read");
    const url = new URL(request.url);
    const hours = Number(url.searchParams.get("hours") ?? "24");
    const [signals, quality, search] = await Promise.all([
      getDiscoverySignals(),
      getCatalogQualityFindings(200),
      getSearchDiagnostics(Number.isFinite(hours) ? hours : 24),
    ]);
    return adminJson({
      signals,
      catalogQuality: { findings: quality, count: quality.length },
      search,
      note: "Discovery intelligence is observational and must not be treated as canonical catalog, inventory, price, order, payment, fulfillment, authorization, or customer-account state.",
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
