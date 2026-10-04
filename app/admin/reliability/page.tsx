import { requireAdmin } from "@/lib/admin/authorization";
import { db } from "@/lib/db/client";

export const dynamic="force-dynamic";

export default async function ReliabilityPage(){
 await requireAdmin(undefined,"reliability.read");
 const [assessments,signals,anomalies,strategies,circuits,regressions]=await Promise.all([
  db.reliabilityAssessment.findMany({orderBy:{updatedAt:"desc"},take:20}),
  db.reliabilitySignal.findMany({orderBy:{observedAt:"desc"},take:20}),
  db.reliabilityAnomaly.findMany({orderBy:{detectedAt:"desc"},take:20}),
  db.reliabilityStrategy.findMany({orderBy:{updatedAt:"desc"},take:20}),
  db.reliabilityCircuit.findMany({orderBy:{updatedAt:"desc"},take:20}),
  db.reliabilityRegression.findMany({orderBy:{createdAt:"desc"},take:20})
 ]);
 return <section className="space-y-8">
  <header className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000]">
   <p className="text-sm font-black uppercase tracking-[0.2em]">Reliability intelligence</p>
   <h2 className="mt-2 text-4xl font-black uppercase">Autonomous reliability</h2>
   <p className="mt-3 max-w-4xl text-sm">Deterministic signal correlation, bounded hypotheses, explicit confidence, governed strategies, adaptive baselines, anomaly detection, postcondition verification and regression circuit breakers. Unknown is never treated as healthy.</p>
  </header>
  <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
   {[["Signals",signals.length],["Assessments",assessments.length],["Anomalies",anomalies.length],["Strategies",strategies.length],["Open circuits",circuits.filter(c=>c.state==="OPEN").length],["Regressions",regressions.length]].map(([k,v])=><div key={String(k)} className="border-2 border-black bg-white p-4"><p className="text-xs font-black uppercase">{String(k)}</p><p className="text-2xl font-black">{String(v)}</p></div>)}
  </section>
  <section className="grid gap-4 lg:grid-cols-2">
   <div className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Active assessments</h3><div className="mt-3 space-y-2">{assessments.map(a=><div key={a.id} className="border-2 border-black p-3 text-sm"><b>{a.state}</b> · {a.confidence}<div>{a.selectionRationale}</div><div className="text-xs">{a.updatedAt.toISOString()}</div></div>)}{!assessments.length&&<p>No assessments recorded.</p>}</div></div>
   <div className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Remediation strategies</h3><div className="mt-3 space-y-2">{strategies.map(s=><div key={s.id} className="border-2 border-black p-3 text-sm"><b>{s.stableId} v{s.version}</b> · {s.status} · {s.risk}<div>{s.name}</div><div className="text-xs">Steps {s.maxSteps} · mutations {s.maxMutations} · timeout {s.timeoutSeconds}s</div></div>)}</div></div>
  </section>
  <section className="grid gap-4 lg:grid-cols-2">
   <div className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Signals & anomalies</h3><div className="mt-3 space-y-2 text-sm">{signals.slice(0,10).map(s=><div key={s.id} className="border-2 border-black p-2">{s.severity} · {s.service} · {s.kind}</div>)}{anomalies.slice(0,10).map(a=><div key={a.id} className="border-2 border-black p-2">ANOMALY · {a.metricKey} · {a.explanation}</div>)}</div></div>
   <div className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Regression & circuits</h3><div className="mt-3 space-y-2 text-sm">{circuits.map(c=><div key={c.id} className="border-2 border-black p-2"><b>{c.state}</b> · {c.strategyId} · {c.reason??"No reason"}</div>)}{regressions.map(r=><div key={r.id} className="border-2 border-black p-2">REGRESSION · {r.metricKey} · {r.explanation}</div>)}</div></div>
  </section>
  <section className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Safety boundary</h3><p className="mt-2 text-sm">Autonomous mutation is limited to explicitly registered safe actions. Financial mutation, customer/catalog truth mutation, arbitrary SQL/shell, undocumented provider calls, Qikink catalog/shipping/credential operations, security disablement and destructive repair remain prohibited.</p></section>
 </section>;
}
