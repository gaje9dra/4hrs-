import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { getAdminOrder } from "@/lib/admin/orders";
import { AdminOrderAction } from "@/components/admin/order-action";

function Section({title,children}:{title:string;children:React.ReactNode}){return <section className="border-4 border-black bg-white p-5 shadow-[6px_6px_0_0_#000]"><h3 className="text-xl font-black uppercase">{title}</h3><div className="mt-4">{children}</div></section>}

export default async function AdminOrderDetailPage({params}:{params:Promise<{orderId:string}>}){
 const context=await requireAdmin(undefined,"orders.read"); const id=(await params).orderId; let order;
 try{order=await getAdminOrder(id);}catch(error){if(error instanceof AdminError&&error.code==="NOT_FOUND")notFound();throw error;}
 const endpoint="/api/admin/orders/"+order.orderNumber+"/actions";
 return <section className="space-y-6">
  <header className="flex flex-wrap items-end justify-between gap-4 border-4 border-black bg-[#f7d51d] p-6 shadow-[8px_8px_0_0_#000]"><div><Link href="/admin/orders" className="font-black underline">← Orders</Link><p className="mt-4 text-xs font-black uppercase tracking-[0.2em]">{order.status}</p><h2 className="mt-1 text-4xl font-black uppercase">{order.orderNumber}</h2><p className="mt-1 text-sm">{new Date(order.createdAt).toLocaleString("en-IN")}</p></div><div className="flex flex-wrap gap-2">{context.permissions.has("orders.cancel")&&order.cancellations.filter(x=>!["REJECTED","COMPLETED"].includes(x.status)).map(c=><span key={c.id} className="flex gap-2"><AdminOrderAction endpoint={endpoint} label="Approve cancellation" action="review_cancellation" payload={{cancellationReference:c.reference,decision:"APPROVE"}} tone="red"/><AdminOrderAction endpoint={endpoint} label="Reject cancellation" action="review_cancellation" payload={{cancellationReference:c.reference,decision:"REJECT"}}/></span>)}</div></header>

  <div className="grid gap-6 xl:grid-cols-2">
   <Section title="Summary"><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs font-black uppercase">Order ID</dt><dd className="break-all">{order.id}</dd></div><div><dt className="text-xs font-black uppercase">Checkout</dt><dd className="break-all">{order.checkoutReference}</dd></div><div><dt className="text-xs font-black uppercase">Subtotal</dt><dd className="font-black">{order.pricing.currency} {order.pricing.subtotal}</dd></div><div><dt className="text-xs font-black uppercase">Total</dt><dd className="font-black">{order.pricing.currency} {order.pricing.total}</dd></div></dl></Section>
   <Section title="Customer"><p className="font-black">{order.customer.displayName||"Unnamed customer"}</p><p>{order.customer.email}</p><p className="mt-2 text-xs break-all">Customer ID: {order.customer.id}</p>{order.address&&<div className="mt-4 border-2 border-black p-3"><p className="font-black uppercase">Shipping address snapshot</p><p>{order.address.recipientName}{order.address.phone?" · "+order.address.phone:""}</p><p>{order.address.addressLine1}{order.address.addressLine2?", "+order.address.addressLine2:""}</p><p>{order.address.city}, {order.address.stateOrProvince} {order.address.postalCode}, {order.address.countryCode}</p></div>}</Section>
  </div>

  <Section title="Items"><div className="grid gap-3">{order.items.map(item=><article key={item.id} className="border-2 border-black p-3"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-black">{item.productTitle}</p><p className="text-sm">{item.variantTitle||"Default variant"} · Store SKU: {item.storeSku||"—"}</p></div><p className="font-black">{item.currency} {item.lineTotal}</p></div><p className="mt-1 text-sm">Qty {item.quantity} · Unit {item.currency} {item.unitPrice}</p>
   {item.selectedOptions&&Object.keys(item.selectedOptions).length ? (
    <div className="mt-2 flex flex-wrap gap-2">
     {Object.entries(item.selectedOptions).map(([name,value])=>(
      <span key={name} className="border-2 border-black bg-[#f7d51d] px-2 py-1 text-xs font-black uppercase">
       {name}: {value}
      </span>
     ))}
    </div>
   ) : null}</article>)}</div></Section>

  <div className="grid gap-6 xl:grid-cols-2">
   <Section title="Payment"><p className="font-black">{order.payment.status}</p><p>{order.payment.currency} {order.payment.amount}</p><p className="text-sm">Provider: {order.payment.providerId||"—"} · Reference: {order.payment.providerReference||"—"}</p><h4 className="mt-4 font-black uppercase">Attempts</h4><div className="mt-2 grid gap-2">{order.payment.attempts.map(a=><p key={a.id} className="border-2 border-black p-2 text-sm">#{a.attemptNumber} · {a.status} · {a.providerAttemptReference||"no provider attempt ref"}{a.failureCode?" · "+a.failureCode:""}</p>)}</div></Section>
   <Section title="Fulfillment">{order.fulfillment?<><p className="font-black">{order.fulfillment.status}</p><p>Provider: {order.fulfillment.provider} · Ref: {order.fulfillment.providerFulfillmentReference||"—"}</p>{order.fulfillment.errorMessage&&<p className="mt-2 border-2 border-[#ff5a36] p-2 text-sm">{order.fulfillment.errorMessage}</p>}{context.permissions.has("fulfillment.manage")&&<div className="mt-4 flex flex-wrap gap-2"><AdminOrderAction endpoint={endpoint} label="Retry fulfillment" action="fulfillment_retry" payload={{fulfillmentId:order.fulfillment.id}}/><AdminOrderAction endpoint={endpoint} label="Reconcile fulfillment" action="fulfillment_reconcile" payload={{fulfillmentId:order.fulfillment.id}}/></div>}</>:<p>No fulfillment record exists.</p>}</Section>
  </div>

  <Section title="Shipping & tracking">{order.shipments.length?<div className="grid gap-4">{order.shipments.map(s=><article key={s.id} className="border-2 border-black p-3"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-black">{s.shipmentReference} · {s.status}</p><p>{s.carrier||"Carrier pending"} · Tracking {s.trackingNumber||"—"}</p></div>{context.permissions.has("shipping.manage")&&<AdminOrderAction endpoint={endpoint} label="Reconcile shipment" action="shipping_reconcile" payload={{shipmentId:s.id}}/>}</div>{s.reconciliationRequired&&<p className="mt-2 border-2 border-[#ff5a36] p-2 text-sm">Reconciliation required: {s.reconciliationReason||"No reason recorded."}</p>}<div className="mt-3 grid gap-2">{s.trackingEvents.map(e=><p key={e.id} className="border-l-4 border-black pl-2 text-sm">{new Date(e.eventTimestamp).toLocaleString("en-IN")} · <strong>{e.normalizedStatus}</strong>{e.description?" · "+e.description:""}</p>)}</div></article>)}</div>:<p>No shipment exists.</p>}</Section>

  <div className="grid gap-6 xl:grid-cols-2">
   <Section title="Cancellations">{order.cancellations.length?<div className="grid gap-3">{order.cancellations.map(c=><article key={c.id} className="border-2 border-black p-3"><p className="font-black">{c.reference} · {c.status}</p><p className="text-sm">Reason: {c.reason}</p><p className="text-sm">{c.customerDescription||"No customer description."}</p>{c.operationalReason&&<p className="text-sm">Operational reason: {c.operationalReason}</p>}</article>)}</div>:<p>No cancellation request.</p>}</Section>
   <Section title="Returns">{order.returns.length?<div className="grid gap-3">{order.returns.map(r=><article key={r.id} className="border-2 border-black p-3"><p className="font-black">{r.reference} · {r.status}</p><p className="text-sm">{r.reasonCode}</p>{context.permissions.has("returns.manage")&&["REQUESTED","UNDER_REVIEW"].includes(r.status)&&<div className="mt-3 flex flex-wrap gap-2"><AdminOrderAction endpoint={endpoint} label="Approve return" action="review_return" payload={{returnReference:r.reference,decision:"APPROVE"}}/><AdminOrderAction endpoint={endpoint} label="Reject return" action="review_return" payload={{returnReference:r.reference,decision:"REJECT"}} tone="red"/></div>}</article>)}</div>:<p>No return request.</p>}</Section>
  </div>

  <Section title="Timeline"><ol className="grid gap-2">{order.timeline.map((e,i)=><li key={e.resourceId+"-"+i} className="border-l-4 border-black pl-3"><p className="text-xs font-black uppercase">{new Date(e.occurredAt).toLocaleString("en-IN")} · {e.type}</p><p>{e.label}</p></li>)}</ol></Section>
  <Section title="Admin audit"><div className="grid gap-2">{order.audit.length?order.audit.map((e,i)=><p key={e.createdAt+"-"+i} className="border-2 border-black p-2 text-sm">{new Date(e.createdAt).toLocaleString("en-IN")} · <strong>{e.action}</strong> · {e.success?"success":"failure"}{e.reason?" · "+e.reason:""}</p>):<p>No centralized admin audit entries exist for this order.</p>}</div></Section>
 </section>;
}
