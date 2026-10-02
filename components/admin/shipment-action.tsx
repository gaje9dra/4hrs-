"use client";
import { useState } from "react";
function key(){return crypto.randomUUID()+"-"+Date.now().toString(36);}
function Reason({children,onRun,disabled=false}:{children:string;onRun:(reason:string)=>Promise<void>;disabled?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 async function run(){const reason=window.prompt("Operational reason (required):");if(!reason||reason.trim().length<3)return;setBusy(true);setError(null);try{await onRun(reason.trim());}catch(e){setError(e instanceof Error?e.message:"Operation failed.");setBusy(false);}}
 return <div><button type="button" disabled={busy||disabled} onClick={run} className="border-2 border-black bg-[#f7d51d] px-3 py-2 font-black uppercase disabled:opacity-50">{busy?"Working…":children}</button>{error&&<p role="alert" className="mt-1 max-w-xs text-xs font-bold text-red-700">{error}</p>}</div>;
}
export function AdminShipmentCreate(){
 return <Reason disabled={false} onRun={async(reason)=>{const orderId=window.prompt("Canonical Order ID (UUID):");if(!orderId)throw new Error("Order ID is required.");const fulfillmentId=window.prompt("Canonical Fulfillment ID (UUID):");if(!fulfillmentId)throw new Error("Fulfillment ID is required.");const res=await fetch("/api/admin/shipping",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"create",orderId,fulfillmentId,idempotencyKey:key(),reason})});const body=await res.json().catch(()=>null);if(!res.ok)throw new Error(body?.error?.message||"Shipment creation failed.");window.location.assign("/admin/shipping/"+body.id);}}>Create Shipment from Fulfillment</Reason>;
}
export function AdminShipmentAction({endpoint,action,children}:{endpoint:string;action:"reconcile"|"recovery";children:string}){
 return <Reason onRun={async(reason)=>{const res=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,idempotencyKey:key(),reason})});const body=await res.json().catch(()=>null);if(!res.ok)throw new Error(body?.error?.message||"Shipment operation failed.");window.location.reload();}}>{children}</Reason>;
}
