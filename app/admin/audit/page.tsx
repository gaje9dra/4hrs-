import { requireAdmin } from "@/lib/admin/authorization";
import { listAdminAudit } from "@/lib/admin/application";
export default async function AdminAuditPage(){
  await requireAdmin(undefined,"admin.audit.read");
  const result=await listAdminAudit(100);
  return <section className="space-y-6">
    <header><p className="text-sm font-black uppercase tracking-[0.2em]">Administration</p><h2 className="text-4xl font-black uppercase">Audit log</h2><p className="mt-2 max-w-2xl text-sm">Administrative audit records are append-only through the normal admin application boundary. Secret-shaped metadata is sanitized before persistence.</p></header>
    <div className="overflow-x-auto border-4 border-black bg-white"><table className="min-w-full text-left text-sm"><thead><tr className="border-b-4 border-black"><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Resource</th><th className="p-3">Success</th><th className="p-3">Reason</th></tr></thead><tbody>
      {result.items.map((row)=><tr key={row.id} className="border-b-2 border-black last:border-b-0"><td className="p-3 whitespace-nowrap">{row.createdAt}</td><td className="p-3 font-bold">{row.action}</td><td className="p-3">{row.resourceType ?? "—"}{row.resourceId ? " / " + row.resourceId : ""}</td><td className="p-3">{row.success ? "Yes" : "No"}</td><td className="p-3">{row.reason ?? "—"}</td></tr>)}
    </tbody></table></div>
  </section>;
}