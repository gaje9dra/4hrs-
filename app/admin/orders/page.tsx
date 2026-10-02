import Link from "next/link";
import { requireAdmin } from "@/lib/admin/authorization";
import { listAdminOrders, parseAdminOrderQuery } from "@/lib/admin/orders";

export default async function AdminOrdersPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const context=await requireAdmin(undefined,"orders.read");
 void context;
 const raw=await searchParams;
 const url=new URL("https://admin.local/admin/orders");
 for(const [key,value] of Object.entries(raw)){if(Array.isArray(value)) value.forEach(v=>url.searchParams.append(key,v));else if(value!==undefined) url.searchParams.set(key,value);}
 const query=parseAdminOrderQuery(url); const data=await listAdminOrders(query);
 const baseParams=Object.fromEntries(url.searchParams);
 return <section className="space-y-6">
  <header className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000]"><p className="text-xs font-black uppercase tracking-[0.2em]">Operational control plane</p><h2 className="mt-2 text-4xl font-black uppercase">Orders</h2><p className="mt-2 max-w-3xl">Read-only order visibility is separated from explicitly authorized operational actions. Historical order snapshots are never edited from this interface.</p></header>
  <form method="get" className="border-4 border-black bg-[#f7d51d] p-4 shadow-[6px_6px_0_0_#000]">
   <div className="grid gap-3 md:grid-cols-4">
    <label className="md:col-span-2"><span className="text-xs font-black uppercase">Search</span><input name="search" defaultValue={query.search||""} placeholder="Order number, email, customer, SKU" className="mt-1 w-full border-2 border-black bg-white p-2"/></label>
    <label><span className="text-xs font-black uppercase">Order status</span><select name="status" defaultValue={query.status||""} className="mt-1 w-full border-2 border-black bg-white p-2"><option value="">All</option><option>PENDING</option><option>CONFIRMED</option></select></label>
    <label><span className="text-xs font-black uppercase">Payment</span><select name="paymentStatus" defaultValue={query.paymentStatus||""} className="mt-1 w-full border-2 border-black bg-white p-2"><option value="">All</option>{["CREATED","REQUIRES_ACTION","PROCESSING","SUCCEEDED","FAILED","CANCELLED","EXPIRED","REFUNDED","PARTIALLY_REFUNDED"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label><span className="text-xs font-black uppercase">Fulfillment</span><select name="fulfillmentStatus" defaultValue={query.fulfillmentStatus||""} className="mt-1 w-full border-2 border-black bg-white p-2"><option value="">All</option>{["PENDING","SUBMITTED","FAILED","COMPLETED"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label><span className="text-xs font-black uppercase">Shipment</span><select name="shipmentStatus" defaultValue={query.shipmentStatus||""} className="mt-1 w-full border-2 border-black bg-white p-2"><option value="">All</option>{["CREATED","IN_TRANSIT","OUT_FOR_DELIVERY","DELIVERED","DELIVERY_FAILED","RETURNED"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label><span className="text-xs font-black uppercase">From</span><input type="date" name="from" defaultValue={query.from?.toISOString().slice(0,10)||""} className="mt-1 w-full border-2 border-black bg-white p-2"/></label>
    <label><span className="text-xs font-black uppercase">To</span><input type="date" name="to" defaultValue={query.to?.toISOString().slice(0,10)||""} className="mt-1 w-full border-2 border-black bg-white p-2"/></label>
   </div>
   <div className="mt-3 flex flex-wrap gap-2"><button className="border-2 border-black bg-black px-4 py-2 font-black uppercase text-white" type="submit">Apply filters</button><Link href="/admin/orders" className="border-2 border-black bg-white px-4 py-2 font-black uppercase">Reset</Link></div>
  </form>
  <div className="border-4 border-black bg-white">
   <div className="overflow-x-auto">
    <table className="w-full min-w-[1000px] border-collapse"><caption className="sr-only">Administrative order list</caption><thead><tr className="border-b-4 border-black bg-black text-left text-xs font-black uppercase text-white">{["Order","Customer","Order","Payment","Fulfillment","Shipment","Cancellation","Return","Total"].map((x,i)=><th key={x+i} className="p-3">{x}</th>)}</tr></thead>
    <tbody>{data.orders.map(row=><tr key={row.id} className="border-b-2 border-black align-top"><td className="p-3"><Link className="font-black underline" href={"/admin/orders/"+row.orderNumber}>{row.orderNumber}</Link><p className="text-xs">{new Date(row.createdAt).toLocaleString("en-IN")}</p></td><td className="p-3"><p className="font-bold">{row.customer.displayName||"—"}</p><p className="text-xs break-all">{row.customer.email}</p></td><td className="p-3 font-black">{row.status}</td><td className="p-3">{row.paymentStatus}</td><td className="p-3">{row.fulfillmentStatus||"—"}</td><td className="p-3">{row.shipmentStatus||"—"}</td><td className="p-3">{row.cancellationStatus||"—"}</td><td className="p-3">{row.returnStatus||"—"}</td><td className="p-3 font-black">{row.currency} {row.total}</td></tr>)}</tbody>
    </table>
   </div>
   {data.orders.length===0&&<p className="p-6 font-bold">No orders matched the current filters.</p>}
  </div>
  <footer className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold">Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} orders</p><div className="flex gap-2">{query.page>1&&<Link className="border-2 border-black bg-white px-3 py-2 font-bold uppercase" href={"/admin/orders?"+new URLSearchParams({...baseParams,page:String(query.page-1)}).toString()}>Previous</Link>}{data.pagination.hasNextPage&&<Link className="border-2 border-black bg-[#f7d51d] px-3 py-2 font-bold uppercase" href={"/admin/orders?"+new URLSearchParams({...baseParams,page:String(query.page+1)}).toString()}>Next</Link>}</div></footer>
 </section>;
}
