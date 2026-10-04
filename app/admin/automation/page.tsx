import { requireAdmin } from "@/lib/admin/authorization";
import { getAutomationOverview } from "@/lib/automation/service";

export const dynamic="force-dynamic";

export default async function AutomationPage(){
 const context=await requireAdmin(undefined,"automation.read");
 const data=await getAutomationOverview();
 const enabled=data.policies.filter(p=>p.enabled).length;
 const openCircuits=data.circuits.filter(c=>c.state==="OPEN").length;
 return <section className="space-y-8">
  <header className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000]">
   <p className="text-sm font-black uppercase tracking-[0.2em]">Production operations</p>
   <h2 className="mt-2 text-4xl font-black uppercase">Automation control</h2>
   <p className="mt-3 max-w-3xl text-sm">Deterministic automation with explicit risk classification, dry-run defaults, bounded actions, approval controls, idempotency records and circuit breakers. Newly introduced policies remain disabled until explicitly activated.</p>
  </header>
  <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
   {[["Policies",data.policies.length],["Enabled",enabled],["Executions",data.executions.length],["Pending approvals",data.pendingApprovals.length],["Open circuits",openCircuits]].map(([label,value])=><div key={String(label)} className="border-2 border-black bg-white p-4"><p className="text-xs font-black uppercase">{String(label)}</p><p className="mt-1 text-2xl font-black">{String(value)}</p></div>)}
  </section>
  <section className="border-4 border-black bg-white">
   <div className="border-b-4 border-black p-4"><h3 className="text-xl font-black uppercase">Policy inventory</h3></div>
   <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b-2 border-black"><th className="p-3">Policy</th><th className="p-3">Risk</th><th className="p-3">State</th><th className="p-3">Dry run</th><th className="p-3">Owner / reviewer</th></tr></thead>
   <tbody>{data.policies.map(p=><tr key={p.id} className="border-b-2 border-black last:border-0"><td className="p-3"><div className="font-black">{p.name}</div><div className="text-xs">{p.stableId} · v{p.version}</div></td><td className="p-3 font-black">{p.risk}</td><td className="p-3 font-black">{p.status}{p.enabled?" · ENABLED":" · DISABLED"}</td><td className="p-3">{p.dryRun?"YES":"NO"}</td><td className="p-3">{p.owner}{p.reviewer?" / "+p.reviewer:""}</td></tr>)}</tbody></table></div>
  </section>
  <section className="grid gap-4 lg:grid-cols-2">
   <div className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Execution history</h3><div className="mt-3 space-y-2 text-sm">{data.executions.slice(0,20).map(e=><div key={e.id} className="border-2 border-black p-3"><div className="font-black">{e.state} · {e.risk}</div><div>{e.targetResource} · {e.environment}</div><div className="text-xs break-all">{e.idempotencyKey}</div></div>)}{data.executions.length===0&&<p>No automation executions recorded.</p>}</div></div>
   <div className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Circuit breakers</h3><div className="mt-3 space-y-2 text-sm">{data.circuits.map(c=><div key={c.id} className="border-2 border-black p-3"><div className="font-black">{c.state}</div><div>Failures: {c.consecutiveFailures} consecutive / {c.totalFailures} total</div><div>{c.reason??"No circuit reason recorded."}</div></div>)}{data.circuits.length===0&&<p>No circuit records.</p>}</div></div>
  </section>
  <section className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Registered action catalog</h3><div className="mt-3 grid gap-2 md:grid-cols-2">{data.registeredActions.map(a=><div key={a.key} className="border-2 border-black p-3"><div className="font-black">{a.key}</div><div className="text-xs uppercase">{a.risk} · rollback: {a.rollback}</div><p className="mt-1 text-sm">{a.label}</p></div>)}</div></section>
  <section className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Safety boundary</h3><p className="mt-2 text-sm">No arbitrary shell execution, SQL execution, provider mutation, payment mutation, catalog mutation, secret access or browser-side privileged remediation is registered. Qikink remains fulfillment-only.</p><p className="mt-2 text-sm font-bold">{context.permissions.has("automation.manage")?"Policy-management permission is available.":"Read/evidence access only."}</p></section>
 </section>;
}
