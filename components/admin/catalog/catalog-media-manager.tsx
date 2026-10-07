"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Media={id:string;url:string;isPrimary:boolean};

export function CatalogMediaManager({productId,images,canManage}:{productId:string;images:Media[];canManage:boolean}) {
 const router=useRouter();
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);

 async function upload(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  setBusy(true);
  setError("");
  const form=e.currentTarget;
  const data=new FormData(form);
  data.set("productId",productId);
  data.set("isPrimary",data.get("isPrimary")==="on"?"true":"false");
  const res=await fetch("/api/admin/catalog/images/upload",{method:"POST",body:data});
  const b=await res.json().catch(()=>({}));
  if(!res.ok)setError(b?.error?.message||"Could not upload image.");
  else{form.reset();router.refresh();}
  setBusy(false);
 }

 async function remove(id:string){
  const reason=window.prompt("Reason for removing this media:");
  if(!reason||reason.trim().length<3)return;
  setBusy(true);setError("");
  const res=await fetch("/api/admin/catalog/media/"+id,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({reason})});
  const b=await res.json().catch(()=>({}));
  if(!res.ok)setError(b?.error?.message||"Could not remove media.");
  else router.refresh();
  setBusy(false);
 }

 async function primary(id:string){
  setBusy(true);setError("");
  const res=await fetch("/api/admin/catalog/media/"+id+"/primary",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
  const b=await res.json().catch(()=>({}));
  if(!res.ok)setError(b?.error?.message||"Could not set primary media.");
  else router.refresh();
  setBusy(false);
 }

 return <div className="space-y-4">
  {canManage&&<form onSubmit={upload} className="grid gap-3 border-2 border-black p-3">
   <div>
    <label className="block text-xs font-black uppercase" htmlFor={productId+"-image-file"}>Product image</label>
    <input id={productId+"-image-file"} name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required disabled={busy} className="mt-1 block w-full border-2 border-black bg-white p-2 text-sm"/>
    <p className="mt-1 text-xs">JPEG, PNG, WebP or GIF · maximum 4 MB</p>
   </div>
   <input name="altText" placeholder="Alt text" disabled={busy} className="border-2 border-black p-2"/>
   <label className="flex items-center gap-2 text-sm font-bold"><input name="isPrimary" type="checkbox" disabled={busy}/> Primary image</label>
   <button disabled={busy} className="border-2 border-black bg-[#f7d51d] p-2 font-bold uppercase">{busy?"Uploading…":"Upload image"}</button>
  </form>}
  {error&&<p role="alert" className="border-2 border-black bg-[#ff5a36] p-2 font-bold">{error}</p>}
  <div className="grid gap-3">
   {images.map(i=><div key={i.id} className="flex flex-wrap items-center justify-between gap-3 border-2 border-black p-2">
    <div className="flex min-w-0 items-center gap-3">
     <img src={i.url} alt="" className="h-16 w-16 border-2 border-black object-cover" />
     <span className="max-w-[50%] truncate text-sm">{i.url.startsWith("data:")?"Uploaded image":i.url}</span>
     <span className="text-xs font-bold">{i.isPrimary?"PRIMARY":""}</span>
    </div>
    {canManage&&<div className="flex gap-2">
     {!i.isPrimary&&<button type="button" disabled={busy} onClick={()=>void primary(i.id)} className="border-2 border-black px-2 py-1 text-xs font-bold uppercase">Primary</button>}
     <button type="button" disabled={busy} onClick={()=>void remove(i.id)} className="border-2 border-black bg-[#ff5a36] px-2 py-1 text-xs font-bold uppercase">Remove</button>
    </div>}
   </div>)}
  </div>
 </div>;
}
