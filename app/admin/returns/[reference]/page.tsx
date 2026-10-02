import Link from "next/link";
import {notFound} from "next/navigation";
import {requireAdmin} from "@/lib/admin/authorization";
import {getAdminReturn} from "@/lib/admin/post-order";
import {PostOrderAction} from "@/components/admin/post-order-action";
import {ReturnInspectionAction} from "@/components/admin/return-inspection-action";
export const dynamic="force-dynamic";
export default async function ReturnDetail({params}:{params:Promise<{reference:string}>}){
 const context=await requireAdmin(undefined,"return.read");const p=await params;
 const row=await getAdminReturn(p.reference,context.permissions.has("customers.read"),context.permissions.has("return.audit.read")).catch(e=>{if(e?.code==="NOT_FOUND")return null;throw e});
 if(!row)notFound();
 return <section className="space-y-6">
  <Link href="/admin/returns" className="font-black underline">← Returns</Link>
  <header className="border-4 border-black bg-[#f7d51d] p-6 shadow-[8px_8px_0_0_#000]"><p className="text-xs font-black uppercase">{row.status}</p><h2 className="break-all text-4xl font-black">{row.reference}</h2><p>Order {row.order.orderNumber} · Eligibility: {row.eligibility}</p></header>
  <div className="grid gap-6 lg:grid-cols-2">
   <section className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Items</h3>{row.items.map(i=><article key={i.id} className="border-b-2 border-black py-3"><strong>{i.productTitle}</strong><p>{i.variantTitle??"—"} · SKU {i.storeSku??"—"} · Qty {i.quantity}</p><p>{i.currency} {i.lineTotal}</p></article>)}</section>
   <section className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Return shipment</h3>{row.shipment?(<><p>{row.shipment.reference} · {row.shipment.status}</p><p>Carrier: {row.shipment.carrier??"—"}</p><p>Tracking: {row.shipment.trackingNumber??"Restricted"}</p></>):<p>No Return Shipment.</p>}<h3 className="mt-5 font-black uppercase">Inspection</h3><p>{row.inspection?row.inspection.outcome:"Not inspected"}</p></section>
  </div>
  <div className="grid gap-3 md:grid-cols-2">
   {context.permissions.has("return.inspect")&&row.status==="RETURN_RECEIVED"&&<ReturnInspectionAction reference={row.reference}/>}
   {context.permissions.has("return.approve")&&row.status==="REQUESTED"&&<PostOrderAction endpoint={"/api/admin/returns/"+row.reference} action="approve" label="Approve return"/>}
   {context.permissions.has("return.reject")&&row.status==="REQUESTED"&&<PostOrderAction endpoint={"/api/admin/returns/"+row.reference} action="reject" label="Reject return"/>}
   {context.permissions.has("return.resolve")&&row.status==="INSPECTED"&&<PostOrderAction endpoint={"/api/admin/returns/"+row.reference} action="resolve_rejected" label="Resolve as rejected"/>}
  </div>
  <section className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Resolution</h3><p>{row.resolution?row.resolution.type:"Pending"}</p><p>{row.resolution?.note??"—"}</p></section>
  <section className="border-4 border-black bg-white p-5"><h3 className="font-black uppercase">Domain timeline</h3>{row.domainAudit.map((e,i)=><p key={e.createdAt+"-"+i} className="border-b border-black py-2">{new Date(e.createdAt).toLocaleString("en-IN")} · <strong>{e.action}</strong> · {e.previousState??"—"} → {e.newState??"—"}</p>)}</section>
 </section>;
}