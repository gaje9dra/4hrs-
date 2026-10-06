import { requireAdmin } from "@/lib/admin/authorization";
import { listDeployments } from "@/lib/deployment-control/service";

export const dynamic = "force-dynamic";

export default async function DeploymentPage() {
  const auth = await requireAdmin(undefined, "deployment.read");
  const rows = await listDeployments();
  const active = rows.filter((row) => !["CERTIFIED","ABORTED","ROLLED_BACK","FAILED","INVALIDATED"].includes(row.status)).length;
  const blocked = rows.filter((row) => ["BLOCKED","PAUSED","ROLLBACK_PENDING","FORWARD_RECOVERY_REQUIRED"].includes(row.status)).length;

  return (
    <div className="min-h-screen bg-[#f2f0e6] p-6 text-black">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="border-4 border-black bg-white p-6">
          <p className="text-xs font-black uppercase">4HRS+ / Deployment intelligence</p>
          <h1 className="mt-2 text-4xl font-black uppercase">Incident-aware deployment control</h1>
          <p className="mt-2 max-w-4xl text-sm">
            Provider-neutral deployment governance linked to approved change and release records.
            Execution is limited to registered operations and never accepts arbitrary commands.
          </p>
        </header>
        <section className="grid gap-4 md:grid-cols-4">
          <div className="border-2 border-black bg-white p-4"><b className="text-xs uppercase">Deployments</b><p className="text-3xl font-black">{rows.length}</p></div>
          <div className="border-2 border-black bg-white p-4"><b className="text-xs uppercase">Active</b><p className="text-3xl font-black">{active}</p></div>
          <div className="border-2 border-black bg-white p-4"><b className="text-xs uppercase">Blocked / paused</b><p className="text-3xl font-black">{blocked}</p></div>
          <div className="border-2 border-black bg-white p-4"><b className="text-xs uppercase">Arbitrary execution</b><p className="text-3xl font-black">0</p></div>
        </section>
        <section className="border-4 border-black bg-white">
          <div className="border-b-4 border-black p-4"><h2 className="font-black uppercase">Deployment dashboard</h2></div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b-2 border-black">
                <th className="p-3">Deployment</th><th className="p-3">Environment</th><th className="p-3">Status</th>
                <th className="p-3">Recovery</th><th className="p-3">Gates</th><th className="p-3">Certification</th>
              </tr></thead>
              <tbody>
                {rows.map((row) => <tr key={row.id} className="border-b-2 border-black">
                  <td className="p-3 font-black">{row.stableId}</td>
                  <td className="p-3">{row.environment}</td>
                  <td className="p-3">{row.status}</td>
                  <td className="p-3">{row.recoveryClass}</td>
                  <td className="p-3">{row.gates.filter((gate) => gate.result === "PASS").length}/{row.gates.length}</td>
                  <td className="p-3">{row.certifications[0]?.status ?? "NONE"}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>
        <p className="text-xs">Authorized roles: {auth.adminUser.roles.length}. High-risk deployment controls remain permission-gated and auditable.</p>
      </section>
    </div>
  );
}
