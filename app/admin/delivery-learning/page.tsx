import { requireAdmin } from "@/lib/admin/authorization";
import { listLearning, listOutcomes } from "@/lib/delivery-learning/service";
export const dynamic="force-dynamic";
export default async function DeliveryLearningPage(){
 await requireAdmin(undefined,"delivery_learning.view");
 const [proposals,outcomes]=await Promise.all([listLearning({limit:50}),listOutcomes(50)]);
 const counts=proposals.reduce((a,p)=>{a[p.lifecycleState]=(a[p.lifecycleState]??0)+1;return a;},{} as Record<string,number>);
 return <main className="min-h-screen bg-[#f2f0e6] p-6 text-black"><section className="mx-auto max-w-7xl space-y-6">
  <header className="border-4 border-black bg-white p-6"><p className="text-xs font-black uppercase">4HRS+ / Phase 15.40</p><h1 className="mt-2 text-4xl font-black uppercase">Delivery learning & outcome optimization</h1><p className="mt-2 max-w-4xl text-sm">Governed evaluation of delivery outcomes, prediction quality, signal quality and optimization proposals. Learning never executes production changes.</p></header>
  <section className="grid gap-4 md:grid-cols-5">{[["Outcomes",outcomes.length],["Proposals",proposals.length],["Review",counts.GOVERNANCE_REVIEW??0],["Verified",counts.VERIFIED??0],["Certified",counts.CERTIFIED??0]].map(([k,v])=><div key={String(k)} className="border-2 border-black bg-white p-4"><b className="text-xs uppercase">{k}</b><p className="text-3xl font-black">{v}</p></div>)}</section>
  <section className="border-4 border-black bg-white"><div className="border-b-4 border-black p-4"><h2 className="font-black uppercase">Optimization proposals</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b-2 border-black"><th className="p-3">Problem</th><th className="p-3">Safety</th><th className="p-3">Confidence</th><th className="p-3">Lifecycle</th><th className="p-3">Algorithm</th></tr></thead><tbody>{proposals.map(p=><tr key={p.id} className="border-b border-black"><td className="p-3">{p.problem}</td><td className="p-3">{p.safetyClass}</td><td className="p-3">{p.evidenceConfidence}</td><td className="p-3">{p.lifecycleState}</td><td className="p-3">{p.algorithmVersion}</td></tr>)}</tbody></table></div></section>
 </section></main>
}
