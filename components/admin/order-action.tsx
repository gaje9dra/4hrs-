"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminOrderAction({endpoint,label,action,payload,tone="yellow"}:{endpoint:string;label:string;action:string;payload:Record<string,unknown>;tone?:"yellow"|"red"|"black"}){
 const router=useRouter();const [open,setOpen]=useState(false);const [reason,setReason]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function run(){
  setBusy(true);setError("");
  const res=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...payload,action,reason})});
  const body=await res.json().catch(()=>({}));
  if(!res.ok){setError(body?.error?.message||"The operation failed.");setBusy(false);return;}
  setOpen(false);setBusy(false);setReason("");router.refresh();
 }
 return <div className="space-y-2">
  {open?<div className="border-2 border-black bg-white p-3">
   <label className="block text-xs font-black uppercase" htmlFor={action+"-reason"}>Reason</label>
   <textarea id={action+"-reason"} value={reason} onChange={e=>setReason(e.target.value)} rows={3} maxLength={1000} className="mt-2 w-full border-2 border-black p-2" aria-describedby={action+"-help"}/>
   <p id={action+"-help"} className="mt-1 text-xs">Required. This action is operationally auditable.</p>
   <div className="mt-2 flex gap-2"><button type="button" disabled={busy||reason.trim().length<3} onClick={run} className="border-2 border-black bg-[#f7d51d] px-3 py-2 font-bold uppercase">{busy?"Working…":"Confirm"}</button><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="border-2 border-black px-3 py-2 font-bold uppercase">Cancel</button></div>
  </div>:<button type="button" onClick={()=>setOpen(true)} className={"border-2 border-black px-3 py-2 font-bold uppercase "+(tone==="red"?"bg-[#ff5a36]":tone==="black"?"bg-black text-white":"bg-[#f7d51d]")}>{label}</button>}
  {error&&<p role="alert" className="text-sm font-bold">{error}</p>}
 </div>;
}
