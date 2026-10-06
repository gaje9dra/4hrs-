import { readFile, writeFile, mkdir } from "node:fs/promises";

type Sample = { endpoint:string; scenario:string; requests:number; concurrency:number; errors:number; errorRate:number; p50Ms:number|null; p95Ms:number|null; p99Ms:number|null; throughputRps:number; };

function percentile(values:number[], p:number){ if(!values.length)return null; const s=[...values].sort((a,b)=>a-b); return Number(s[Math.min(s.length-1,Math.ceil(p*s.length/100)-1)].toFixed(2)); }

async function run(endpoint:string, requests:number, concurrency:number):Promise<Omit<Sample,"endpoint"|"scenario">>{
 const d:number[]=[]; let errors=0; let next=0;
 async function worker(){ while(true){ const i=next++; if(i>=requests)return; const t=performance.now(); try{const c=new AbortController(); const timer=setTimeout(()=>c.abort(),5000); const r=await fetch(new URL(endpoint,process.env.PERF_BASE_URL)); clearTimeout(timer); if(!r.ok)errors++; await r.arrayBuffer();}catch{errors++;} d.push(performance.now()-t);}}
 await Promise.all(Array.from({length:Math.min(concurrency,requests)},()=>worker()));
 const elapsed=Math.max(...d,0)/1000;
 return {requests,concurrency,errors,errorRate:Number((errors/requests).toFixed(4)),p50Ms:percentile(d,50),p95Ms:percentile(d,95),p99Ms:percentile(d,99),throughputRps:Number((requests/Math.max(elapsed,0.001)).toFixed(2))};
}

if(!process.env.PERF_BASE_URL) throw new Error("PERF_BASE_URL is required");
const endpoints=["/api/health","/api/ready","/api/readiness","/"];
const scenarios=[["normal",20,2],["elevated",60,5],["spike",40,10]] as const;
const samples:Sample[]=[];
for(const endpoint of endpoints) for(const [scenario,requests,concurrency] of scenarios){
 const result=await run(endpoint,requests,concurrency);
 samples.push({endpoint,scenario,...result});
}
const sustainedStart=Date.now();
let sustainedRequests=0;
while(Date.now()-sustainedStart<15000){ await run("/api/health",5,1); sustainedRequests+=5; }
const serverPid=process.env.NEXT_SERVER_PID;
let serverRssKb:number|null=null;
if(serverPid){ try{const proc=await readFile("/proc/"+serverPid+"/status","utf8"); serverRssKb=Number(/VmRSS:\s+(\d+)/.exec(proc)?.[1] ?? "0") || null;}catch{} }
const report={generatedAt:new Date().toISOString(),environment:"isolated CI PostgreSQL + local Next.js production server",productionTraffic:false,scenarios:samples,soak:{durationSeconds:15,requests:sustainedRequests,endpoint:"/api/health"},serverRssKb};
await mkdir("artifacts",{recursive:true});
await writeFile("artifacts/phase-16-11-runtime-benchmark.json",JSON.stringify(report,null,2)+"\n");
const bad=samples.filter(x=>x.errors>0 || (x.p95Ms??999999)>5000);
console.log(JSON.stringify({samples:samples.length,bad:bad.length,soakRequests:sustainedRequests,serverRssKb}));
if(bad.length)process.exit(1);
