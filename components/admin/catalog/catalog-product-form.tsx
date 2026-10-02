"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Product = { id?: string; title?: string; slug?: string; description?: string|null; shortDescription?: string|null; price?: string|number; compareAtPrice?: string|number|null; currency?: string; seoTitle?: string|null; seoDescription?: string|null; status?: string; updatedAt?: string; };
export function CatalogProductForm({ product, mode }: { product?: Product; mode: "create"|"edit" }) {
  const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data=Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload={...data, price:String(data.price), compareAtPrice:data.compareAtPrice?String(data.compareAtPrice):null, currency:String(data.currency||"INR"), ...(mode==="edit"&&product?.updatedAt?{expectedUpdatedAt:product.updatedAt}: {})};
    const response=await fetch(mode==="create"?"/api/admin/catalog?resource=products":"/api/admin/catalog/products/"+product!.id,{method:mode==="create"?"POST":"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){setError(body?.error?.message||"The catalog operation failed.");setBusy(false);return;}
    router.push(mode==="create"?"/admin/catalog":"/admin/catalog/"+product!.id); router.refresh();
  }
  return <form onSubmit={submit} className="grid gap-5 border-4 border-black bg-white p-5 shadow-[6px_6px_0_0_#000]">
    <div><label className="block text-sm font-black uppercase" htmlFor="title">Title</label><input id="title" name="title" required maxLength={180} defaultValue={product?.title??""} className="mt-2 w-full border-2 border-black p-3" /></div>
    <div className="grid gap-4 md:grid-cols-2"><div><label className="block text-sm font-black uppercase" htmlFor="slug">Slug</label><input id="slug" name="slug" required maxLength={180} defaultValue={product?.slug??""} className="mt-2 w-full border-2 border-black p-3" /></div><div><label className="block text-sm font-black uppercase" htmlFor="price">Price (INR)</label><input id="price" name="price" required inputMode="decimal" defaultValue={product?.price??""} className="mt-2 w-full border-2 border-black p-3" /></div></div>
    <div><label className="block text-sm font-black uppercase" htmlFor="description">Description</label><textarea id="description" name="description" rows={5} defaultValue={product?.description??""} className="mt-2 w-full border-2 border-black p-3" /></div>
    <div><label className="block text-sm font-black uppercase" htmlFor="shortDescription">Short description</label><textarea id="shortDescription" name="shortDescription" rows={2} defaultValue={product?.shortDescription??""} className="mt-2 w-full border-2 border-black p-3" /></div>
    <div className="grid gap-4 md:grid-cols-3"><div><label className="block text-sm font-black uppercase" htmlFor="compareAtPrice">Compare-at price</label><input id="compareAtPrice" name="compareAtPrice" inputMode="decimal" defaultValue={product?.compareAtPrice??""} className="mt-2 w-full border-2 border-black p-3" /></div><div><label className="block text-sm font-black uppercase" htmlFor="currency">Currency</label><input id="currency" name="currency" maxLength={3} defaultValue={product?.currency??"INR"} className="mt-2 w-full border-2 border-black p-3" /></div><div><label className="block text-sm font-black uppercase" htmlFor="seoTitle">SEO title</label><input id="seoTitle" name="seoTitle" maxLength={180} defaultValue={product?.seoTitle??""} className="mt-2 w-full border-2 border-black p-3" /></div></div>
    <div><label className="block text-sm font-black uppercase" htmlFor="seoDescription">SEO description</label><textarea id="seoDescription" name="seoDescription" rows={3} defaultValue={product?.seoDescription??""} className="mt-2 w-full border-2 border-black p-3" /></div>
    {error&&<p role="alert" className="border-2 border-black bg-[#ff5a36] p-3 font-bold">{error}</p>}
    <button disabled={busy} className="border-4 border-black bg-[#f7d51d] px-5 py-3 font-black uppercase shadow-[4px_4px_0_0_#000] disabled:opacity-50">{busy?"Saving…":mode==="create"?"Create draft":"Save changes"}</button>
  </form>;
}
