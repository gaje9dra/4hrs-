"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Variant={id:string;sku:string;displayName:string|null;size:string|null;color:string|null;price:string|null;status:"ACTIVE"|"INACTIVE";updatedAt:string};
type ValidationIssue={field:string;code:string;message:string};
type ErrorResponse={error?:{message?:unknown;details?:{issues?:unknown}}};

function validationIssues(value:unknown):ValidationIssue[]{
 if(!Array.isArray(value)) return [];
 return value.filter((issue:unknown):issue is ValidationIssue =>
  typeof issue==="object" && issue!==null &&
  "message" in issue && typeof (issue as {message?:unknown}).message==="string" &&
  "field" in issue && typeof (issue as {field?:unknown}).field==="string"
 );
}

function errorMessage(body:ErrorResponse,fallback:string):string{
 const message=typeof body.error?.message==="string"?body.error.message:fallback;
 const issues=validationIssues(body.error?.details?.issues);
 return [message,...issues.map((issue)=>"• "+issue.message)].join("\n");
}

export function CatalogVariantManager({productId,variants,canManage}:{productId:string;variants:Variant[];canManage:boolean}) {
 const router=useRouter(); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 async function add(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");
  const d=Object.fromEntries(new FormData(e.currentTarget).entries());
  const res=await fetch("/api/admin/catalog/products/variants",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({productId,...d,price:d.price?String(d.price):null,status:d.status==="INACTIVE"?"INACTIVE":"ACTIVE"})});
  const b=await res.json().catch(()=>({})) as ErrorResponse;
  if(!res.ok)setError(errorMessage(b,"Could not create variant."));
  else{e.currentTarget.reset();router.refresh()}
  setBusy(false);
 }
 async function update(id:string,updatedAt:string,e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");
  const d=Object.fromEntries(new FormData(e.currentTarget).entries());
  const res=await fetch("/api/admin/catalog/variants/"+id,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({...d,price:d.price?String(d.price):null,expectedUpdatedAt:updatedAt})});
  const b=await res.json().catch(()=>({})) as ErrorResponse;
  if(!res.ok)setError(errorMessage(b,"Could not update variant."));
  else router.refresh();
  setBusy(false);
 }
 async function deactivate(id:string){
  const reason=window.prompt("Reason for deactivating this variant:");if(!reason||reason.trim().length<3)return;
  setBusy(true);setError("");
  const res=await fetch("/api/admin/catalog/variants/"+id,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({reason})});
  const b=await res.json().catch(()=>({})) as ErrorResponse;
  if(!res.ok)setError(errorMessage(b,"Could not deactivate variant."));else router.refresh();
  setBusy(false);
 }
 return <div className="space-y-4">
  {canManage&&<form onSubmit={add} className="grid gap-2 border-2 border-black p-3 md:grid-cols-4">
   <input name="sku" required placeholder="Store SKU" className="border-2 border-black p-2"/>
   <input name="displayName" placeholder="Display name" className="border-2 border-black p-2"/>
   <input name="size" placeholder="Size" className="border-2 border-black p-2"/>
   <input name="color" placeholder="Color" className="border-2 border-black p-2"/>
   <input name="price" inputMode="decimal" placeholder="Price" className="border-2 border-black p-2"/>
   <input type="hidden" name="status" value="ACTIVE"/>
   <button disabled={busy} className="border-2 border-black bg-[#f7d51d] p-2 font-bold uppercase md:col-span-3">Add variant</button>
  </form>}
  <div className="grid gap-3">{variants.map(v=><div key={v.id} className="border-2 border-black p-3">
   <div className="flex flex-wrap justify-between gap-2"><strong>{v.sku}</strong><span className="font-bold">{v.status}</span></div>
   <p className="mt-1 text-xs">Store SKU is canonical. Provider SKU is managed separately.</p>
   {canManage&&<form onSubmit={e=>void update(v.id,v.updatedAt,e)} className="mt-3 grid gap-2 md:grid-cols-4">
    <input name="sku" defaultValue={v.sku} required className="border-2 border-black p-2"/>
    <input name="displayName" defaultValue={v.displayName??""} placeholder="Display name" className="border-2 border-black p-2"/>
    <input name="size" defaultValue={v.size??""} placeholder="Size" className="border-2 border-black p-2"/>
    <input name="color" defaultValue={v.color??""} placeholder="Color" className="border-2 border-black p-2"/>
    <input name="price" defaultValue={v.price??""} placeholder="Price" className="border-2 border-black p-2"/>
    <button disabled={busy} className="border-2 border-black bg-[#f7d51d] px-3 py-2 text-xs font-bold uppercase md:col-span-3">Save variant</button>
   </form>}
   {canManage&&v.status==="ACTIVE"&&<button type="button" disabled={busy} onClick={()=>void deactivate(v.id)} className="mt-2 border-2 border-black bg-[#ff5a36] px-3 py-2 text-xs font-bold uppercase">Deactivate</button>}
  </div>)}</div>
  {error&&<p role="alert" className="whitespace-pre-line border-2 border-black bg-[#ff5a36] p-2 font-bold">{error}</p>}
 </div>;
}
