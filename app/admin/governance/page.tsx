import { GovernanceControlActions } from "@/components/admin/governance-control-actions";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/authorization";
import { governanceSummary, listGovernanceControls } from "@/lib/governance/service";

export const dynamic = "force-dynamic";

export default async function GovernancePage() {
  const context = await requireAdmin(undefined, "governance.read");
  const [summary, controls] = await Promise.all([governanceSummary(), listGovernanceControls({ limit: 100 })]);
  const canVerify = context.permissions.has("governance.verify");
  const canExport = context.permissions.has("governance.export");
  return <section className="space-y-8">
    <header className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-black uppercase tracking-[0.2em]">Production governance</p><h2 className="mt-2 text-4xl font-black uppercase">Control inventory</h2><p className="mt-3 max-w-3xl text-sm">Operational evidence and control state only. This surface does not assert legal or external compliance certification.</p></div>
        {canExport ? <Link href="/api/admin/governance?export=1" className="border-2 border-black bg-black px-4 py-3 font-black uppercase text-white">Export audit package</Link> : null}
      </div>
    </header>
    <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-7">
      {Object.entries({total:summary.total,critical:summary.critical,failed:summary.failed,blocked:summary.blocked,unknown:summary.unknown,overdue:summary.overdue,exceptions:summary.activeExceptions}).map(([key,value]) => <div key={key} className="border-2 border-black bg-white p-4"><p className="text-xs font-black uppercase">{key}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}
    </section>
    <section className="border-4 border-black bg-white">
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b-4 border-black"><th className="p-3">Control</th><th className="p-3">Domain</th><th className="p-3">Criticality</th><th className="p-3">Owner</th><th className="p-3">Status</th><th className="p-3">Evidence</th><th className="p-3">Verification</th><th className="p-3">Action</th></tr></thead><tbody>
      {controls.map((control)=><tr key={control.id} className="border-b-2 border-black last:border-b-0"><td className="p-3"><div className="font-black">{control.key}</div><div>{control.title}</div></td><td className="p-3">{control.domain}</td><td className="p-3">{control.criticality}</td><td className="p-3">{control.ownerRole}</td><td className="p-3 font-bold">{control.status}</td><td className="p-3">{control._count.evidence}</td><td className="p-3">{control._count.verifications}</td><td className="p-3"><GovernanceControlActions controlKey={control.key} canVerify={canVerify} /></td></tr>)}
      </tbody></table></div>
    </section>
    <p className="text-xs">Recent verifications: {summary.verificationsLast24h}. Governance is intentionally isolated from storefront, checkout, payment, order and fulfillment execution paths.</p>
  </section>;
}
