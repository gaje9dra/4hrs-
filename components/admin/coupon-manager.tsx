"use client";
import { useCallback, useEffect, useState } from "react";

type Coupon = { id:string; code:string; discountPercent:number; maxRedemptions:number; completedRedemptions:number; reservedRedemptions:number; remainingUses:number; startsAt:string|null; expiresAt:string; status:"DRAFT"|"ACTIVE"|"INACTIVE"; description:string|null; minimumSubtotal:string|null; maximumDiscountAmount:string|null };
const inputClass = "w-full border-2 border-black bg-white p-3";
const labelClass = "grid gap-1 text-sm font-bold uppercase";
async function request(path:string, init?:RequestInit) {
  const response = await fetch(path,{...init,cache:"no-store",credentials:"same-origin",headers:{Accept:"application/json","Content-Type":"application/json",...(init?.headers??{})}});
  const body = await response.json().catch(()=>null);
  if(!response.ok) throw new Error(body?.error?.message ?? "Coupon request failed.");
  return body;
}
export function CouponManager() {
  const [items,setItems]=useState<Coupon[]>([]);
  const [search,setSearch]=useState("");
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [pending,setPending]=useState(false);
  const [form,setForm]=useState({code:"",discountPercent:"10",maxRedemptions:"10",startsAt:"",expiresAt:"",minimumSubtotal:"",maximumDiscountAmount:"",perCustomerLimit:"",description:"",status:"DRAFT"});
  const load=useCallback(async()=>{try{const data=await request("/api/admin/coupons?search="+encodeURIComponent(search));setItems(data.items??[]);setError(null);}catch(e){setError(e instanceof Error?e.message:"Could not load coupons.");}},[search]);
  useEffect(() => {
    let active = true;
    void request("/api/admin/coupons?search=" + encodeURIComponent(search))
      .then((data) => { if (active) { setItems(data.items ?? []); setError(null); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load coupons."); });
    return () => { active = false; };
  }, [search]);
  async function create(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setPending(true);setError(null);setNotice(null);
    try{
      await request("/api/admin/coupons",{method:"POST",body:JSON.stringify({...form,discountPercent:Number(form.discountPercent),maxRedemptions:Number(form.maxRedemptions),startsAt:form.startsAt||null,minimumSubtotal:form.minimumSubtotal||null,maximumDiscountAmount:form.maximumDiscountAmount||null,perCustomerLimit:form.perCustomerLimit?Number(form.perCustomerLimit):null})});
      setForm({code:"",discountPercent:"10",maxRedemptions:"10",startsAt:"",expiresAt:"",minimumSubtotal:"",maximumDiscountAmount:"",perCustomerLimit:"",description:"",status:"DRAFT"});
      setNotice("Coupon created.");await load();
    }catch(e){setError(e instanceof Error?e.message:"Coupon could not be created.");}finally{setPending(false);}
  }
  async function setStatus(coupon:Coupon,status:Coupon["status"]){
    setPending(true);setError(null);setNotice(null);
    try{await request("/api/admin/coupons",{method:"PATCH",body:JSON.stringify({id:coupon.id,status})});setNotice(coupon.code+" updated.");await load();}
    catch(e){setError(e instanceof Error?e.message:"Coupon could not be updated.");}finally{setPending(false);}
  }
  const field=(key:keyof typeof form,title:string,type="text",required=false)=><label className={labelClass}>{title}<input className={inputClass} type={type} value={form[key]} required={required} onChange={e=>setForm(s=>({...s,[key]:e.target.value}))}/></label>;
  return <div className="space-y-8">
    <section className="border-4 border-black bg-white p-5 shadow-[6px_6px_0_0_#000]">
      <h3 className="text-xl font-black uppercase">Create coupon</h3><p className="mb-5 mt-1 text-sm">Percentage discounts with redemption limits and expiry. Codes are normalized to uppercase.</p>
      <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy={pending}>
        {field("code","Coupon code","text",true)}
        {field("discountPercent","Discount percentage","number",true)}
        {field("maxRedemptions","Maximum successful uses","number",true)}
        {field("startsAt","Start date (optional)","datetime-local")}
        {field("expiresAt","Expiry date and time","datetime-local",true)}
        {field("minimumSubtotal","Minimum subtotal (INR)","number")}
        {field("maximumDiscountAmount","Maximum discount (INR)","number")}
        {field("perCustomerLimit","Per-customer limit","number")}
        <label className={labelClass}>Initial status<select className={inputClass} value={form.status} onChange={e=>setForm(s=>({...s,status:e.target.value}))}><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
        <label className={labelClass+" sm:col-span-2 xl:col-span-3"}>Description / internal note<textarea className={inputClass} rows={2} value={form.description} onChange={e=>setForm(s=>({...s,description:e.target.value}))}/></label>
        <div className="sm:col-span-2 xl:col-span-3"><button disabled={pending} className="border-2 border-black bg-[#f7d51d] px-5 py-3 font-black uppercase shadow-[4px_4px_0_0_#000] disabled:opacity-50">{pending?"Saving…":"Create coupon"}</button></div>
      </form>
    </section>
    {notice&&<p role="status" className="border-2 border-black bg-green-100 p-3 font-bold">{notice}</p>}
    {error&&<p role="alert" className="border-2 border-black bg-red-100 p-3 font-bold">{error}</p>}
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-2xl font-black uppercase">All coupons</h3><p className="text-sm">Completed redemptions and reserved capacity are shown separately.</p></div><input aria-label="Search coupon code" placeholder="Search code" className="border-2 border-black bg-white p-3" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="overflow-x-auto border-4 border-black bg-white"><table className="min-w-[900px] w-full text-left"><thead className="border-b-4 border-black text-xs uppercase"><tr>{["Coupon","Discount","Completed","Reserved","Remaining","Expiry","Status","Action"].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{items.map(c=><tr key={c.id} className="border-b-2 border-black last:border-0"><td className="p-3"><strong>{c.code}</strong><div className="text-xs">{c.description}</div></td><td className="p-3">{c.discountPercent}%</td><td className="p-3">{c.completedRedemptions}</td><td className="p-3">{c.reservedRedemptions}</td><td className="p-3">{c.remainingUses}/{c.maxRedemptions}</td><td className="p-3 text-sm">{new Date(c.expiresAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</td><td className="p-3 font-bold">{new Date(c.expiresAt)<=new Date()?"EXPIRED":c.remainingUses===0?"EXHAUSTED":c.status}</td><td className="p-3"><button disabled={pending} onClick={()=>void setStatus(c,c.status==="ACTIVE"?"INACTIVE":"ACTIVE")} className="border-2 border-black px-3 py-2 text-xs font-black uppercase disabled:opacity-50">{c.status==="ACTIVE"?"Deactivate":"Activate"}</button></td></tr>)}{items.length===0&&<tr><td colSpan={8} className="p-6 text-center">No coupons found.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
