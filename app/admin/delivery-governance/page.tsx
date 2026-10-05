import { requireAdmin } from "@/lib/admin/authorization";
import * as svc from "@/lib/delivery-governance-intelligence/service";

export const dynamic="force-dynamic";
export default async function DeliveryGovernancePage(){
 await requireAdmin(undefined,"governance.intelligence.read");
 const [proposals,assessments,certifications]=await Promise.all([
  svc.listProposals(50),
  svc.listAssessments(50),
  svc.listCertifications(50)
 ]);
 const counts=proposals.reduce<Record<string,number>>((a,p)=>{a[p.lifecycleState]=(a[p.lifecycleState]??0)+1;return a;},{});
 return <main className="space-y-6 p-6"><header><p className="text-sm text-muted-foreground">Phase 15.41</p><h1 className="text-2xl font-semibold">Delivery Governance Intelligence</h1><p className="mt-1 text-sm text-muted-foreground">Policy effectiveness, drift, optimization evidence and controlled evolution. Existing delivery governance remains authoritative.</p></header>
 <section className="grid gap-4 md:grid-cols-3">{[["Assessments",assessments.length],["Proposals",proposals.length],["Certifications",certifications.length]].map(([k,v])=><div key={k} className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">{k}</div><div className="mt-1 text-2xl font-semibold">{v}</div></div>)}</section>
 <section className="rounded-lg border p-4"><h2 className="font-semibold">Lifecycle</h2><pre className="mt-3 overflow-auto text-xs">{JSON.stringify(counts,null,2)}</pre></section>
 <section className="rounded-lg border p-4"><h2 className="font-semibold">Safety boundary</h2><p className="mt-2 text-sm text-muted-foreground">Recommendations are observational/proposal-only. Production policy changes must pass existing change governance, simulation/rehearsal, deployment governance, validation and certification.</p></section>
 </main>;
}
