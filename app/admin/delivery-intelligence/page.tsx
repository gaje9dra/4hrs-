import { requireAdmin } from "@/lib/admin/authorization";
import { listAssessments } from "@/lib/delivery-intelligence/service";

export const dynamic="force-dynamic";

export default async function DeliveryIntelligencePage(){
 const auth=await requireAdmin(undefined,"delivery:intelligence:view");
 const rows=await listAssessments();
 const blocked=rows.filter(r=>["BLOCK","PROHIBIT","HOLD"].includes(r.decision)).length;
 const expired=rows.filter(r=>r.expiresAt<=new Date()).length;
 return <main className="min-h-screen bg-[#f2f0e6] p-6 text-black"><section className="mx-auto max-w-7xl space-y-6">
  <header className="border-4 border-black bg-white p-6"><p className="text-xs font-black uppercase">4HRS+ / Delivery intelligence</p><h1 className="mt-2 text-4xl font-black uppercase">Dependency-aware promotion governance</h1><p className="mt-2 max-w-4xl text-sm">Deterministic promotion decisions backed by dependency health, evidence freshness, safety gates, approvals and certification.</p></header>
  <section className="grid gap-4 md:grid-cols-4">
   <div className="border-2 border-black bg-white p-4"><b className="text-xs uppercase">Assessments</b><p className="text-3xl font-black">{rows.length}</p></div>
   <div className="border-2 border-black bg-white p-4"><b className="text-xs uppercase">Blocked / held</b><p className="text-3xl font-black">{blocked}</p></div>
   <div className="border-2 border-black bg-white p-4"><b className="text-xs uppercase">Expired</b><p className="text-3xl font-black">{expired}</p></div>
   <div className="border-2 border-black bg-white p-4"><b className="text-xs uppercase">Autonomous execution</b><p className="text-3xl font-black">0</p></div>
  </section>
  <section className="border-4 border-black bg-white"><div className="border-b-4 border-black p-4"><h2 className="font-black uppercase">Promotion assessments</h2></div>
   <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b-2 border-black"><th className="p-3">Target</th><th className="p-3">Decision</th><th className="p-3">Risk</th><th className="p-3">Confidence</th><th className="p-3">Gates</th><th className="p-3">Expires</th></tr></thead>
    <tbody>{rows.map(r=><tr key={r.id} className="border-b-2 border-black"><td className="p-3 font-black">{r.targetEnvironment}</td><td className="p-3">{r.decision}</td><td className="p-3">{r.riskLevel}</td><td className="p-3">{r.confidence}</td><td className="p-3">{r.gates.filter(g=>g.status==="PASS").length}/{r.gates.length}</td><td className="p-3">{r.expiresAt.toISOString()}</td></tr>)}</tbody></table></div>
  </section>
  <p className="text-xs">Authorized roles: {auth.adminUser.roles.length}. Decisions remain policy/evidence governed; this surface does not execute arbitrary infrastructure commands or provider operations.</p>
 </section></main>;
}
