"use client";

import { useState } from "react";

function key(){return crypto.randomUUID()+"-"+Date.now().toString(36);}
export function AdminFulfillmentAction({endpoint,action,disabled=false}:{endpoint:string;action:"submit"|"retry"|"reconcile";disabled?:boolean}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
 async function run(){
  const reason=window.prompt("Operational reason (required):");if(!reason||reason.trim().length<3)return;
  setBusy(true);setError(null);
  try{
   const res=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,reason,idempotencyKey:key()})});
   const body=await res.json().catch(()=>null);if(!res.ok)throw new Error(body?.error?.message||"Operation failed.");
   window.location.reload();
  }catch(e){setError(e instanceof Error?e.message:"Operation failed.");setBusy(false);}
 }
 return <div><button type="button" disabled={busy||disabled} onClick={run} className="border-2 border-black bg-[#f7d51d] px-3 py-2 font-black uppercase disabled:opacity-50">{busy?"Working…":action}</button>{error&&<p role="alert" className="mt-1 max-w-xs text-xs font-bold text-red-700">{error}</p>}</div>;
}
export function AdminFulfillmentCreate(){
 const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
 async function run(){
  const orderId=window.prompt("Order ID (UUID):");if(!orderId)return;
  const reason=window.prompt("Operational reason (required):");if(!reason||reason.trim().length<3)return;
  setBusy(true);setError(null);
  try{
   const res=await fetch("/api/admin/fulfillments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"create",orderId,idempotencyKey:key(),reason})});
   const body=await res.json().catch(()=>null);if(!res.ok)throw new Error(body?.error?.message||"Fulfillment creation failed.");
   window.location.assign("/admin/fulfillments/"+body.id);
  }catch(e){setError(e instanceof Error?e.message:"Fulfillment creation failed.");setBusy(false);}
 }
 return <div><button type="button" disabled={busy} onClick={run} className="border-2 border-black bg-black px-4 py-2 font-black uppercase text-white disabled:opacity-50">{busy?"Creating…":"Create fulfillment from order"}</button>{error&&<p role="alert" className="mt-2 text-xs font-bold text-red-700">{error}</p>}</div>;
}
