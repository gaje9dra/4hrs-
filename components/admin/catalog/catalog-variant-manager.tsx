"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Variant={id:string;sku:string;displayName:string|null;size:string|null;color:string|null;price:string|null;status:"ACTIVE"|"INACTIVE";updatedAt:string};
type ValidationIssue={field:string;code:string;message:string};
type ErrorResponse={error?:{message?:unknown;details?:{issues?:unknown}}};

const STANDARD_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

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

function normalizeSize(value:string){
  return value.trim().replace(/\s+/g," ").toUpperCase();
}

function skuFor(baseSku:string,size:string){
  const compact=normalizeSize(size).replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"");
  return `${baseSku.trim().replace(/-+$/,"")}-${compact}`;
}

export function CatalogVariantManager({productId,baseSku,variants,canManage}:{productId:string;baseSku:string|null;variants:Variant[];canManage:boolean}) {
  const router=useRouter();
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [customSize,setCustomSize]=useState("");
  const [pendingSize,setPendingSize]=useState<string|null>(null);

  const existingSizes=useMemo(
    ()=>new Set(variants.filter(v=>v.status==="ACTIVE" && v.size).map(v=>normalizeSize(v.size!))),
    [variants],
  );

  const sizesInCatalog=useMemo(
    ()=>Array.from(new Set(variants.filter(v=>v.size).map(v=>normalizeSize(v.size!)))),
    [variants],
  );

  async function addSize(size:string){
    const normalized=normalizeSize(size);
    if(!normalized || existingSizes.has(normalized)) return;
    if(!baseSku?.trim()){ setError("Add the product base SKU first. Sizes will use Base SKU + size, e.g. 987364-M."); return; }

    setBusy(true);
    setPendingSize(normalized);
    setError("");

    const res=await fetch("/api/admin/catalog/variants",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        productId,
        sku:skuFor(baseSku,normalized),
        displayName:`Size ${normalized}`,
        size:normalized,
        color:null,
        price:null,
        status:"ACTIVE",
      }),
    });

    const body=await res.json().catch(()=>({})) as ErrorResponse;
    if(!res.ok){
      setError(errorMessage(body,"Could not add this size."));
    }else{
      setCustomSize("");
      router.refresh();
    }

    setPendingSize(null);
    setBusy(false);
  }

  async function deactivate(id:string){
    const reason=window.prompt("Reason for removing this size:");
    if(!reason || reason.trim().length<3) return;

    setBusy(true);
    setError("");

    const res=await fetch("/api/admin/catalog/variants/"+id,{
      method:"DELETE",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({reason}),
    });
    const body=await res.json().catch(()=>({})) as ErrorResponse;

    if(!res.ok) setError(errorMessage(body,"Could not remove this size."));
    else router.refresh();

    setBusy(false);
  }

  return (
    <div className="space-y-5">
      {canManage ? (
        <div className="border-2 border-black bg-[#fafafa] p-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.12em]">Available sizes</p>
            <p className="mt-1 text-xs text-gray-600">Enter the product base SKU once in the product details above. The size buttons below generate the complete SKU automatically.</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {STANDARD_SIZES.map((size)=>{
              const active=existingSizes.has(size);
              const loading=pendingSize===size;
              return (
                <button
                  key={size}
                  type="button"
                  disabled={busy || active}
                  onClick={()=>void addSize(size)}
                  className={[
                    "min-w-14 border-2 border-black px-4 py-3 text-sm font-black uppercase",
                    active ? "cursor-default bg-black text-white" : "bg-white hover:-translate-y-0.5 hover:bg-[#f7d51d]",
                    loading ? "opacity-60" : "",
                  ].join(" ")}
                  aria-pressed={active}
                >
                  {loading ? "..." : size}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={customSize}
              onChange={(e)=>setCustomSize(e.target.value)}
              placeholder="Other size (e.g. 5XL)"
              aria-label="Other size"
              className="min-h-11 flex-1 border-2 border-black bg-white px-3 py-2 font-bold uppercase md:max-w-xs"
            />
            <button
              type="button"
              disabled={busy || !normalizeSize(customSize)}
              onClick={()=>void addSize(customSize)}
              className="min-h-11 border-2 border-black bg-[#f7d51d] px-5 py-2 font-black uppercase"
            >
              Add size
            </button>
          </div>
        </div>
      ) : null}

      {sizesInCatalog.length ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-black uppercase tracking-[0.12em]">Customer size options</p>
            <span className="text-xs font-bold">{existingSizes.size} active</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {variants.filter(v=>v.size).map(v=>(
              <div key={v.id} className="border-2 border-black bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-black uppercase">{v.size}</span>
                  <span className={v.status==="ACTIVE" ? "text-xs font-black uppercase" : "text-xs font-black uppercase text-gray-500"}>
                    {v.status==="ACTIVE" ? "Available" : "Unavailable"}
                  </span>
                </div>
                <p className="mt-2 text-[0.68rem] font-bold uppercase text-gray-600">SKU {v.sku}</p>
                {v.color ? <p className="mt-1 text-xs font-bold">Color: {v.color}</p> : null}
                {canManage && v.status==="ACTIVE" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={()=>void deactivate(v.id)}
                    className="mt-3 w-full border-2 border-black bg-[#ff5a36] px-3 py-2 text-xs font-black uppercase"
                  >
                    Remove size
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="border-2 border-dashed border-black p-4 text-sm font-bold uppercase">
          No customer sizes configured yet.
        </p>
      )}

      {error ? (
        <p role="alert" className="whitespace-pre-line border-2 border-black bg-[#ff5a36] p-3 font-bold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
