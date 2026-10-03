"use client";
import { useState } from "react";

export default function ReconciliationActions({id,version,canExecute,canResolve,highRisk}:{id:string;version:number;canExecute:boolean;canResolve:boolean;highRisk:boolean}){
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 async function act(action:string){
  setBusy(true);setMessage("");
  try{
   const body:Record<string,unknown>={action,id,expectedVersion:version};
   if(action==="resolve"){const reason=window.prompt("Resolution reason (required):");if(!reason){setBusy(false);return;}body.reason=reason;}
   const response=await fetch("/api/admin/reconciliation",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
   const data=await response.json(); if(!response.ok) throw new Error(data?.error?.message||"Action failed.");
   setMessage("Completed. Refresh to verify."); window.location.reload();
  }catch(error){setMessage(error instanceof Error?error.message:"Action failed.");}finally{setBusy(false);}
 }
 return <div className="flex flex-wrap gap-2">
  {canExecute&&!highRisk&&<button disabled={busy} onClick={()=>act("retry")} className="border-2 border-black bg-[#f7d51d] px-3 py-1 text-xs font-black uppercase">Safe retry</button>}
  {canResolve&&<button disabled={busy} onClick={()=>act("resolve")} className="border-2 border-black bg-black px-3 py-1 text-xs font-black uppercase text-white">{highRisk?"Resolve (high risk)":"Resolve"}</button>}
  {message&&<span className="text-xs font-bold">{message}</span>}
 </div>;
}