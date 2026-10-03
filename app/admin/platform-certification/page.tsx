import { requireAdmin } from "@/lib/admin/authorization";
import { getLatestPlatformCertification } from "@/lib/platform-certification/service";
export const dynamic="force-dynamic";
export default async function PlatformCertificationPage(){
  await requireAdmin(undefined,"platform.certification.read");
  const latest=await getLatestPlatformCertification();
  const blockers=Array.isArray(latest?.blockers)?latest.blockers:[]; const limitations=Array.isArray(latest?.limitations)?latest.limitations:[];
  return <main className="space-y-6 p-6"><header><h1 className="text-2xl font-semibold">Platform Certification</h1><p className="text-sm opacity-70">Final system certification and go-live evidence.</p></header>
  <section className="rounded-lg border p-5"><div className="text-xs uppercase opacity-60">Readiness</div><div className="mt-1 text-2xl font-semibold">{latest?.readiness??"NOT_CERTIFIED"}</div><p className="mt-2 text-sm opacity-70">{latest?.certificationId??"No certification record exists."}</p></section>
  <section className="rounded-lg border p-5"><h2 className="font-medium">Blockers</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{blockers.length?blockers.map((item,i)=><li key={i}>{typeof item==="object"&&item!==null&&"title" in item?String((item as {title:string}).title):String(item)}</li>):<li>None recorded.</li>}</ul></section>
  <section className="rounded-lg border p-5"><h2 className="font-medium">Limitations</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{limitations.length?limitations.map((item,i)=><li key={i}>{typeof item==="object"&&item!==null&&"title" in item?String((item as {title:string}).title):String(item)}</li>):<li>None recorded.</li>}</ul></section>
  </main>;
}