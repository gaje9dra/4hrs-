"use client";
import { useEffect } from "react";
export default function AnalyticsError({error,reset}:{error:Error&{digest?:string};reset:()=>void}) {
  useEffect(()=>{ console.error(error); },[error]);
  return <section className="space-y-6"><header className="border-4 border-black bg-white p-6"><h2 className="text-3xl font-black uppercase">Analytics unavailable</h2><p className="mt-3 font-semibold">The report could not be generated for the selected reporting contract.</p></header><div className="flex gap-3"><button onClick={reset} className="border-2 border-black bg-black px-5 py-2 font-black uppercase text-white">Try again</button><a href="/admin/analytics" className="border-2 border-black bg-white px-5 py-2 font-black uppercase">Reset report</a></div></section>;
}