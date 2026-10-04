import { requireAdmin } from "@/lib/admin/authorization";
import { getResilienceOverview } from "@/lib/resilience/experiments";

export const dynamic="force-dynamic";

export default async function ResiliencePage(){
 await requireAdmin(undefined,"resilience.read");
 const d=await getResilienceOverview();
 const active=d.experiments.filter(x=>["RUNNING","PAUSING","STOPPING"].includes(x.state)).length;
 const openSuppression=d.suppressions.filter(x=>x.expiresAt>new Date()).length;
 return <section className="space-y-6">
  <header className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000]">
   <p className="text-xs font-black uppercase tracking-[0.2em]">Production resilience engineering</p>
   <h1 className="mt-2 text-4xl font-black uppercase">Resilience Control Plane</h1>
   <p className="mt-3 max-w-4xl text-sm">Governed failure-injection experiments with explicit targets, predefined faults, bounded blast radius, automatic abort conditions, exact approvals, immutable evidence and explainable certification.</p>
  </header>
  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
   {[
    ["Experiments",d.experiments.length],["Active",active],["Targets",d.targets.filter(x=>x.allowlisted).length],
    ["Faults",d.faults.filter(x=>x.enabled).length],["Executions",d.executions.length],["Suppressions",openSuppression]
   ].map(([k,v])=><div key={String(k)} className="border-2 border-black bg-white p-4"><p className="text-[11px] font-black uppercase">{String(k)}</p><p className="mt-1 text-2xl font-black">{String(v)}</p></div>)}
  </section>
  <section className="grid gap-4 lg:grid-cols-2">
   <div className="border-4 border-black bg-white p-5">
    <h2 className="font-black uppercase">Resilience overview</h2>
    <div className="mt-3 space-y-2 text-sm">{d.experiments.slice(0,12).map(x=><div key={x.id} className="border-2 border-black p-3"><b>{x.state}</b> · {x.mode} · {x.category}<div className="font-bold">{x.name}</div><div className="text-xs">Target {x.targetId} · Fault {x.faultId} · expires {x.expiration.toISOString()}</div></div>)}{!d.experiments.length&&<p>No experiments registered.</p>}</div>
   </div>
   <div className="border-4 border-black bg-white p-5">
    <h2 className="font-black uppercase">Experiment registry & fault catalog</h2>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{d.faults.slice(0,14).map(f=><div key={f.id} className="border-2 border-black p-2 text-xs"><b>{f.stableId}</b><div>{f.category} · {f.riskClass}</div><div>max {f.maximumDurationSeconds}s · requests {f.maximumAffectedRequests} · jobs {f.maximumAffectedJobs}</div></div>)}</div>
   </div>
  </section>
  <section className="grid gap-4 lg:grid-cols-3">
   <div className="border-4 border-black bg-white p-5"><h2 className="font-black uppercase">Approval queue</h2><div className="mt-3 space-y-2 text-sm">{d.approvals.slice(0,10).map(a=><div key={a.id} className="border-2 border-black p-2">{a.status} · v{a.experimentVersion}<div>{a.reason}</div><div className="text-xs">expires {a.expiresAt.toISOString()}</div></div>)}</div></div>
   <div className="border-4 border-black bg-white p-5"><h2 className="font-black uppercase">Active experiments</h2><div className="mt-3 space-y-2 text-sm">{d.executions.filter(x=>x.state==="RUNNING").map(x=><div key={x.id} className="border-2 border-black p-2">RUNNING · {x.experimentId}<div>started {x.startedAt?.toISOString()??"—"}</div></div>)}{!d.executions.some(x=>x.state==="RUNNING")&&<p>No active execution.</p>}</div></div>
   <div className="border-4 border-black bg-white p-5"><h2 className="font-black uppercase">Certification</h2><div className="mt-3 space-y-2 text-sm">{d.certificates.slice(0,8).map(c=><div key={c.id} className="border-2 border-black p-2"><b>{c.status}</b> · expires {c.expiresAt.toISOString()}</div>)}{!d.certificates.length&&<p>No certification issued.</p>}</div></div>
  </section>
  <section className="border-4 border-black bg-white p-5">
   <h2 className="font-black uppercase">Guardrails & emergency controls</h2>
   <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2">
    <li>• Default injection is disabled/no-op until a registered adapter exists.</li><li>• Targets are explicit allowlist entries; arbitrary URLs/IPs/SQL/shell are rejected.</li>
    <li>• Production experiments require exact approval binding to version, target, fault, duration and blast radius.</li><li>• One high-risk experiment is permitted per affected environment by default.</li>
    <li>• Abort/rollback records preserve evidence and terminate the execution path.</li><li>• Emergency suppression is RBAC-protected, reason-bound and expires automatically.</li>
   </ul>
  </section>
 </section>;
}
