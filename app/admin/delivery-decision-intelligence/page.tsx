import { requireAdmin } from "@/lib/admin/authorization";
import { listDecisions } from "@/lib/delivery-decision-intelligence/service";

export const dynamic="force-dynamic";

export default async function DecisionIntelligencePage(){
  const auth=await requireAdmin(undefined,"delivery:intelligence:view");
  const rows=await listDecisions();
  const counts=rows.reduce((a,r)=>{const k=r.recommendations[0]?.recommendation??"NONE";a[k]=(a[k]??0)+1;return a;},{} as Record<string,number>);
  return <div className="min-h-screen bg-[#f2f0e6] p-6 text-black"><section className="mx-auto max-w-7xl space-y-6">
    <header className="border-4 border-black bg-white p-6"><p className="text-xs font-black uppercase">4HRS+ / Phase 15.39</p><h1 className="mt-2 text-4xl font-black uppercase">Delivery decision intelligence</h1><p className="mt-2 max-w-4xl text-sm">Explainable, evidence-backed promotion recommendations. This surface advises existing delivery governance and never executes deployment, rollout, rollback, provider, payment or fulfillment actions.</p></header>
    <section className="grid gap-4 md:grid-cols-4">{[["Profiles",String(rows.length)],["Proceed",String(counts.PROCEED??0)],["Reduced exposure",String(counts.REDUCE_EXPOSURE??0)],["Blocked / review",String((counts.BLOCK??0)+(counts.HOLD??0)+(counts.REQUIRE_MANUAL_REVIEW??0))]].map(([k,v])=><div key={k} className="border-2 border-black bg-white p-4"><b className="text-xs uppercase">{k}</b><p className="text-3xl font-black">{v}</p></div>)}</section>
    <section className="border-4 border-black bg-white"><div className="border-b-4 border-black p-4"><h2 className="font-black uppercase">Recommendations</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b-2 border-black"><th className="p-3">Target</th><th className="p-3">Recommendation</th><th className="p-3">Risk</th><th className="p-3">Confidence</th><th className="p-3">Status</th><th className="p-3">Algorithm</th></tr></thead><tbody>{rows.map(r=>{const x=r.recommendations[0];return <tr key={r.id} className="border-b-2 border-black"><td className="p-3 font-black">{r.target}</td><td className="p-3">{x?.recommendation??"—"}</td><td className="p-3">{x?.risk&&typeof x.risk==="object"?Object.values(x.risk as Record<string,{classification?:string}>).reduce((m,v)=>v?.classification??m,"LOW"):"—"}</td><td className="p-3">{x?.confidence??"—"}</td><td className="p-3">{r.status}</td><td className="p-3">{r.algorithmVersion}</td></tr>})}</tbody></table></div></section>
    <p className="text-xs">Authorized roles: {auth.adminUser.roles.length}. Recommendations are advisory until accepted by existing governance; policy and algorithm versions are traceable.</p>
  </section></div>;
}
