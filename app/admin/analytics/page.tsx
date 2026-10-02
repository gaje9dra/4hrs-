import { requireAdmin } from "@/lib/admin/authorization";
import { auditAdminAction } from "@/lib/admin/audit";
import { DEFAULT_ANALYTICS_TIMEZONE, getAdminAnalytics, parseAnalyticsQuery } from "@/lib/admin/analytics";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

function Card({label,value,detail}:{label:string;value:string|number|null;detail?:string}) {
  return <article className="border-4 border-black bg-white p-5 shadow-[6px_6px_0_0_#000]">
    <p className="text-xs font-black uppercase tracking-[0.16em]">{label}</p>
    <p className="mt-2 text-3xl font-black">{value === null ? "Restricted" : value}</p>
    {detail && <p className="mt-2 text-sm font-semibold">{detail}</p>}
  </article>;
}

function Restricted({children}:{children:string}) {
  return <section className="border-4 border-black bg-[#e7e0d2] p-5"><h3 className="font-black uppercase">Restricted</h3><p className="mt-2 text-sm">{children}</p></section>;
}

export default async function AnalyticsPage({searchParams}:{searchParams:SearchParams}) {
  const context = await requireAdmin(undefined, "analytics.read");
  const params = await searchParams;
  const queryString = new URLSearchParams();
  for (const key of ["from","to","timezone","grouping"]) {
    const value = first(params[key]);
    if (value) queryString.set(key, value);
  }

    const query = parseAnalyticsQuery(new URL("https://admin.local/admin/analytics?" + queryString.toString()));
    const financial = context.permissions.has("analytics.financial.read");
    const operations = context.permissions.has("analytics.operations.read");
    const customer = context.permissions.has("analytics.customer.read");
    const analytics = await getAdminAnalytics(query, { financial, operations, customer });

    if (financial || customer) {
      await auditAdminAction(context, {
        action: "ANALYTICS_PAGE_ACCESS",
        resourceType: "AnalyticsReport",
        success: true,
        reason: "Sensitive analytics dashboard access",
        metadata: { from: query.from, to: query.to, timezone: query.timezone, grouping: query.grouping, financial, customer },
      });
    }

    const maxNet = Math.max(1, ...analytics.trends.map((row) => Math.abs(Number(row.netSales))));
    return <section className="space-y-8">
      <header className="border-4 border-black bg-[#f7d51d] p-6 shadow-[8px_8px_0_0_#000]">
        <p className="text-sm font-black uppercase tracking-[0.2em]">Operational intelligence</p>
        <h2 className="mt-2 text-4xl font-black uppercase">Analytics</h2>
        <p className="mt-3 max-w-3xl">Read-only reporting over canonical commerce records. Analytics never changes Order, Payment, Fulfillment, Shipping, Return, Cancellation, Case or Customer state.</p>
      </header>

      <form method="get" className="border-4 border-black bg-white p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-1 text-sm font-bold">From<input type="date" name="from" defaultValue={query.from} className="border-2 border-black p-2"/></label>
          <label className="grid gap-1 text-sm font-bold">To<input type="date" name="to" defaultValue={query.to} className="border-2 border-black p-2"/></label>
          <label className="grid gap-1 text-sm font-bold">Reporting timezone<input name="timezone" defaultValue={query.timezone} maxLength={64} className="border-2 border-black p-2"/></label>
          <label className="grid gap-1 text-sm font-bold">Grouping<select name="grouping" defaultValue={query.grouping} className="border-2 border-black p-2"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button type="submit" className="border-2 border-black bg-black px-5 py-2 font-black uppercase text-white">Refresh report</button><span className="text-sm font-bold">Half-open range: {query.from} ≤ event &lt; {analytics.range.endExclusive}</span></div>
      </form>

      {financial ? <section aria-labelledby="financial-kpis" className="space-y-4"><h3 id="financial-kpis" className="text-2xl font-black uppercase">Sales & payments</h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <Card label="Gross sales" value={analytics.sales.grossSales} detail="Paid orders only"/>
          <Card label="Net sales" value={analytics.sales.netSales} detail="Gross less successful refunds"/>
          <Card label="Paid orders" value={analytics.sales.paidOrderCount}/>
          <Card label="AOV" value={analytics.sales.averageOrderValue}/>
          <Card label="Refunds" value={analytics.sales.refundAmount} detail={`${analytics.payments?.refundCount ?? 0} successful refunds`}/>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Successful payments" value={analytics.payments?.successfulPayments ?? 0}/>
          <Card label="Failed payments" value={analytics.payments?.failedPayments ?? 0}/>
          <Card label="Pending payments" value={analytics.payments?.pendingPayments ?? 0}/>
          <Card label="Payment success rate" value={analytics.payments?.paymentSuccessRate === null ? "N/A" : `${analytics.payments?.paymentSuccessRate}%`}/>
        </div>
      </section> : <Restricted>Financial analytics require the analytics.financial.read permission. Operational analytics remain available according to your role.</Restricted>}

      {operations ? <section aria-labelledby="operations-kpis" className="space-y-4"><h3 id="operations-kpis" className="text-2xl font-black uppercase">Operations</h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Orders" value={analytics.sales.orderCount}/>
          <Card label="Fulfillment attempts" value={analytics.fulfillment?.attempts ?? null}/>
          <Card label="Shipments" value={analytics.shipping?.shipmentCount ?? null}/>
          <Card label="Delivered" value={analytics.shipping?.delivered ?? null}/>
          <Card label="Return requests" value={analytics.returns?.requests ?? null}/>
          <Card label="Resolved returns" value={analytics.returns?.resolved ?? null}/>
          <Card label="Cancellation requests" value={analytics.returns?.cancellations ?? null}/>
          <Card label="Cancellation rate" value={analytics.returns?.cancellationRate === null ? "N/A" : `${analytics.returns?.cancellationRate}%`}/>
          <Card label="Open cases" value={analytics.cases?.openCases ?? null}/>
          <Card label="New cases" value={analytics.cases?.newCases ?? null}/>
          <Card label="Resolved cases" value={analytics.cases?.resolvedCases ?? null}/>
          <Card label="Tracking available" value={analytics.shipping?.trackingAvailable ?? null}/>
        </div>
      </section> : <Restricted>Operational analytics require the analytics.operations.read permission.</Restricted>}

      {customer ? <section className="space-y-4"><h3 className="text-2xl font-black uppercase">Customer analytics</h3><div className="grid gap-5 sm:grid-cols-2"><Card label="New customers" value={analytics.customers?.newCustomers ?? null}/><Card label="Customers with paid orders" value={analytics.customers?.customersWithPaidOrders ?? null}/></div></section> : null}

      {financial ? <section className="space-y-4" aria-labelledby="trend-title"><div className="flex items-end justify-between gap-4"><h3 id="trend-title" className="text-2xl font-black uppercase">Sales trend</h3><p className="text-sm font-bold">{analytics.range.grouping} buckets · {analytics.freshness.model}</p></div>
        <div className="border-4 border-black bg-white p-5">
          {analytics.trends.length === 0 ? <p className="py-10 text-center font-bold">No canonical order data in this reporting range.</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-left text-sm"><caption className="sr-only">Sales trend by reporting bucket</caption><thead><tr className="border-b-4 border-black"><th className="p-2">Period</th><th className="p-2">Paid orders</th><th className="p-2">Gross</th><th className="p-2">Refunds</th><th className="p-2">Net</th><th className="p-2">Relative net</th></tr></thead><tbody>{analytics.trends.map((row)=><tr key={row.bucket} className="border-b border-black"><th scope="row" className="p-2 font-black">{row.bucket}</th><td className="p-2">{row.paidOrderCount}</td><td className="p-2">{row.grossSales}</td><td className="p-2">{row.refundAmount}</td><td className="p-2">{row.netSales}</td><td className="p-2"><div className="h-5 min-w-24 border-2 border-black bg-[#f4efe3]"><div className="h-full bg-[#f7d51d]" style={{width:`${Math.min(100,(Math.abs(Number(row.netSales))/maxNet)*100)}%`}} aria-label={`Relative net sales ${row.netSales}`}/></div></td></tr>)}</tbody></table></div>}
        </div>
      </section> : null}

      <footer className="border-2 border-black bg-white p-4 text-sm"><strong>Reporting contract:</strong> {query.timezone}; {query.from} through {query.to}; data generated {new Date(analytics.freshness.generatedAt).toLocaleString("en-IN",{timeZone:query.timezone})}. No analytics cache is used, so financial reports are live canonical aggregations.</footer>
    </section>;

}
