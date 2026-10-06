import { requireAdmin } from "@/lib/admin/authorization";
import { registryHealth, syntheticSummary } from "@/lib/synthetic";
export const dynamic="force-dynamic";
export default async function SyntheticMonitoringPage(){
  await requireAdmin(undefined,"synthetic.read");
  const [summary,registry]=await Promise.all([syntheticSummary(),Promise.resolve(registryHealth())]);
  return <div className="space-y-6 p-6"><header><h1 className="text-2xl font-semibold">Synthetic Monitoring</h1><p className="text-sm opacity-70">Production-safe workflow validation and readiness evidence.</p></header>
  <section className="grid gap-4 md:grid-cols-4">{[["Executions",summary.total],["Healthy",summary.healthy],["Failing",summary.failing],["Blocked",summary.blocked]].map(([label,value])=><div key={String(label)} className="rounded-lg border p-4"><div className="text-xs uppercase opacity-60">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>)}</section>
  <section className="rounded-lg border p-4"><h2 className="font-medium">Registry</h2><p className="text-sm opacity-70">{registry.workflowCount} workflows: {registry.productionSafeCount} production-safe, {registry.blockedCount} intentionally blocked/unsupported.</p></section>
  <section className="rounded-lg border p-4"><h2 className="font-medium">Latest executions</h2><div className="mt-3 overflow-auto"><table className="min-w-full text-sm"><thead><tr className="text-left"><th>Workflow</th><th>Status</th><th>Environment</th><th>Duration</th><th>Failure</th></tr></thead><tbody>{summary.latest.map(row=><tr key={row.workflowId+row.startedAt.toISOString()} className="border-t"><td className="py-2 pr-4">{row.workflowId}</td><td>{row.status}</td><td>{row.environment}</td><td>{row.durationMs??"—"} ms</td><td>{row.failureCode??"—"}</td></tr>)}</tbody></table></div></section>
  </div>;
}