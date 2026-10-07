"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type PublicationIssue = { message: string };
type ErrorResponse = {
 error?: {
  message?: unknown;
  details?: { issues?: unknown };
 };
};

function publicationIssues(value: unknown): PublicationIssue[] {
 if (!Array.isArray(value)) return [];
 return value.filter((issue: unknown): issue is PublicationIssue =>
  typeof issue === "object" &&
  issue !== null &&
  "message" in issue &&
  typeof (issue as {message?: unknown}).message === "string"
 );
}

export function CatalogAction({ endpoint, label, reasonRequired=false, method="POST", tone="yellow", expectedUpdatedAt }: { endpoint:string; label:string; reasonRequired?:boolean; method?:string; tone?:"yellow"|"black"|"red"; expectedUpdatedAt?:string }) {
 const router=useRouter(); const [open,setOpen]=useState(false); const [reason,setReason]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 async function run(){
  setBusy(true);
  setError("");
  const res=await fetch(endpoint,{method,headers:{"content-type":"application/json"},body:JSON.stringify(reasonRequired?{reason, ...(expectedUpdatedAt?{expectedUpdatedAt}: {})}:{})});
  const b=await res.json().catch(()=>({})) as ErrorResponse;
  if(!res.ok){
   const issues=publicationIssues(b.error?.details?.issues);
   const message=typeof b.error?.message==="string"?b.error.message:"Operation failed.";
   setError([message,...issues.map((issue)=>"• "+issue.message)].join("\n"));
   setBusy(false);
   return;
  }
  setOpen(false);
  router.refresh();
  setBusy(false);
 }
 return <div className="space-y-2">{reasonRequired&&open?<div className="border-2 border-black bg-white p-3"><label className="block text-xs font-black uppercase" htmlFor={endpoint+"-reason"}>Reason</label><textarea id={endpoint+"-reason"} value={reason} onChange={e=>setReason(e.target.value)} rows={3} maxLength={1000} className="mt-2 w-full border-2 border-black p-2" /><div className="mt-2 flex gap-2"><button type="button" disabled={busy||reason.trim().length<3} onClick={run} className="border-2 border-black bg-[#f7d51d] px-3 py-2 font-bold uppercase">Confirm</button><button type="button" onClick={()=>setOpen(false)} className="border-2 border-black px-3 py-2 font-bold uppercase">Cancel</button></div></div>:<button type="button" onClick={()=>reasonRequired?setOpen(true):run()} className={"border-2 border-black px-3 py-2 font-bold uppercase "+(tone==="black"?"bg-black text-white":tone==="red"?"bg-[#ff5a36]":"bg-[#f7d51d")}>{busy?"Working…":label}</button>}{error&&<p role="alert" className="whitespace-pre-line text-sm font-bold">{error}</p>}</div>;
}
