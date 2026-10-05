import { requireAdmin } from "@/lib/admin/authorization";
import * as svc from "@/lib/delivery-governance-stability/service";

export const dynamic="force-dynamic";
export default async function GovernanceStabilityPage(){
 await requireAdmin(undefined,"governance.stability.read");
 const [assessments,conflicts,snapshots,certifications,evidence]=await Promise.all([
  svc.listStability(50),svc.listConflicts(50),svc.listSnapshots(20),svc.listCertifications(20),svc.integratedEvidence()
 ]);
 const counts=assessments.reduce<Record<string,number>>((a,x)=>{a[x.classification]=(a[x.classification]??0)+1;return a;},{});
 return <main className="space-y-6 p-6">
  <header><p className="text-sm text-muted-foreground">Phase 15.43</p><h1 className="text-2xl font-semibold">Governance Stability & Policy Resilience</h1><p className="mt-1 text-sm text-muted-foreground">System-level analysis of control interactions, conflicts, deadlocks, oscillation, churn, coverage and safe degraded governance. Existing delivery execution remains authoritative.</p></header>
  <section className="grid gap-4 md:grid-cols-4">{[["Assessments",assessments.length],["Open conflicts",conflicts.filter(x=>x.resolutionState==="OPEN").length],["Immutable snapshots",snapshots.length],["Certifications",certifications.filter(x=>x.status==="CERTIFIED").length]].map(([k,v])=><div key={k} className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">{k}</div><div className="mt-1 text-2xl font-semibold">{v}</div></div>)}</section>
  <section className="grid gap-4 md:grid-cols-2"><div className="rounded-lg border p-4"><h2 className="font-semibold">Stability classification</h2><pre className="mt-3 overflow-auto text-xs">{JSON.stringify(counts,null,2)}</pre></div><div className="rounded-lg border p-4"><h2 className="font-semibold">Authoritative integrations</h2><pre className="mt-3 overflow-auto text-xs">{JSON.stringify(evidence,null,2)}</pre></div></section>
  <section className="rounded-lg border p-4"><h2 className="font-semibold">Recent conflicts</h2><pre className="mt-3 max-h-80 overflow-auto text-xs">{JSON.stringify(conflicts.slice(0,20),null,2)}</pre></section>
  <section className="grid gap-4 md:grid-cols-2"><div className="rounded-lg border p-4"><h2 className="font-semibold">Degraded governance modes</h2><pre className="mt-3 text-xs">{JSON.stringify(svc.DEGRADED_GOVERNANCE_MODES,null,2)}</pre></div><div className="rounded-lg border p-4"><h2 className="font-semibold">Compatibility model</h2><pre className="mt-3 text-xs">{JSON.stringify(svc.COMPATIBILITY,null,2)}</pre></div></section>
 </main>;
}