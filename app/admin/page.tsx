import Link from "next/link";
import { requireAdmin } from "@/lib/admin/authorization";
import type { AdminPermission } from "@/lib/admin/permissions";
const modules: Array<{name:string;description:string;href:string;permission?:AdminPermission}> = [
  {name:"Catalog",description:"Manage products, variants, taxonomy, media and provider mappings through the protected Catalog control plane.",href:"/admin/catalog",permission:"catalog.read"},
  {name:"Content",description:"Manage governed storefront content, review, publishing, scheduling and rollback.",href:"/admin/content",permission:"content.read"},
  {name:"Orders",description:"Review orders and execute permission-gated operational actions through the canonical Order control plane.",href:"/admin/orders",permission:"orders.read"},
  {name:"Fulfillment",description:"Manage fulfillment records, provider mappings, submission, retry and reconciliation.",href:"/admin/fulfillments",permission:"fulfillment.read"},
  {name:"Shipping",description:"Review shipments, tracking state and permission-gated reconciliation/recovery operations.",href:"/admin/shipping",permission:"shipping.read"},
  {name:"Cancellations",description:"Review and approve/execute customer cancellation requests through the protected post-order control plane.",href:"/admin/cancellations",permission:"cancellation.read"},
  {name:"Returns",description:"Review, inspect and resolve customer returns through the protected post-order control plane.",href:"/admin/returns",permission:"return.read"},
  {name:"Customers",description:"Secure customer search, operational context, privacy-gated insights and canonical profile/status management.",href:"/admin/customers",permission:"customers.read"},
  {name:"Cases",description:"Manage customer cases through centralized authorization, lifecycle transitions and audited actions.",href:"/admin/cases",permission:"case.read"},
  {name:"Payments",description:"Review payment state, verification, reconciliation and permission-gated refund/retry operations.",href:"/admin/payments",permission:"payments.read"},
  {name:"Analytics",description:"Read-only KPI reporting with separate financial, operational and customer permissions.",href:"/admin/analytics",permission:"analytics.read"},
  {name:"Merchandising",description:"Manage governed merchandising records and presentation rules.",href:"/admin/merchandising",permission:"merchandising.read"},
  {name:"Discovery",description:"Inspect discovery and catalog-search intelligence.",href:"/admin/discovery",permission:"discovery.read"},
  {name:"Feature Flags",description:"Review and manage governed feature-flag state.",href:"/admin/feature-flags",permission:"feature_flags.read"},
  {name:"Experiments",description:"Review and manage governed experiments.",href:"/admin/experiments",permission:"experiments.read"},
  {name:"Audit Log",description:"Review administrative actions, authorization decisions and operational evidence.",href:"/admin/audit",permission:"admin.audit.read"},
  {name:"Governance",description:"Inspect controls, evidence, verification state, exceptions and governance readiness.",href:"/admin/governance",permission:"governance.read"},
  {name:"Change Governance",description:"Review impact-aware changes, risk, approvals, rehearsal and release evidence.",href:"/admin/change-governance",permission:"change_governance.read"},
  {name:"Reconciliation",description:"Investigate and resolve cross-domain consistency and provider reconciliation state.",href:"/admin/reconciliation",permission:"reconciliation.read"},
  {name:"Operations",description:"Monitor service health, dependencies, incidents, synthetic evidence and cost/capacity signals.",href:"/admin/operations",permission:"operations.read"},
  {name:"Automation",description:"Inspect governed automation, evaluation, simulation and execution controls.",href:"/admin/automation",permission:"automation.read"},
  {name:"Reliability",description:"Inspect reliability signals, anomalies, governed remediation strategies and circuit state.",href:"/admin/reliability",permission:"reliability.read"},
  {name:"Resilience",description:"Govern bounded failure-injection experiments, approvals, executions, aborts and certification.",href:"/admin/resilience",permission:"resilience.read"},
  {name:"Synthetic Monitoring",description:"Review production-safe synthetic workflows, failures, blockers and readiness evidence.",href:"/admin/synthetic",permission:"synthetic.read"},
  {name:"Simulation",description:"Inspect bounded digital-twin scenarios without mutating commerce state.",href:"/admin/simulation",permission:"simulation.read"},
  {name:"Platform Certification",description:"Review latest platform certification, readiness blockers and limitations.",href:"/admin/platform-certification",permission:"platform.certification.read"},
  {name:"Platform Graph",description:"Inspect dependency intelligence, provenance, confidence, freshness and drift findings.",href:"/admin/platform-graph",permission:"platform_graph.read"},
  {name:"Rehearsal",description:"Review governed change rehearsals and evidence.",href:"/admin/rehearsal",permission:"change_governance.rehearsal"},
  {name:"Releases",description:"Review progressive delivery records and rollout/certification state.",href:"/admin/releases",permission:"release.read"},
  {name:"Deployments",description:"Review incident-aware deployment readiness, recovery and certification state.",href:"/admin/deployments",permission:"deployment.read"},
  {name:"Architecture",description:"Inspect governed architecture state and drift evidence.",href:"/admin/architecture",permission:"architecture.read"}, {name:"Improvements",description:"Manage governed improvement proposals, validation and certification.",href:"/admin/improvements",permission:"improvement.read"}, {name:"Delivery",description:"Inspect governed delivery orchestration and rollout state.",href:"/admin/delivery-orchestration",permission:"delivery.read"}, {name:"Delivery Intelligence",description:"Inspect delivery intelligence and promotion decisions.",href:"/admin/delivery-intelligence",permission:"delivery:intelligence:view"}, {name:"Delivery Learning",description:"Inspect governed delivery learning and experiments.",href:"/admin/delivery-learning",permission:"delivery_learning.view"}, {name:"Delivery Governance",description:"Inspect governance intelligence and adaptation controls.",href:"/admin/delivery-governance",permission:"governance.intelligence.read"}, {name:"Governance Stability",description:"Inspect governance stability and conflict state.",href:"/admin/delivery-governance-stability",permission:"governance.stability.read"}, {name:"Decision Intelligence",description:"Inspect governed delivery decision intelligence.",href:"/admin/delivery-decision-intelligence",permission:"delivery:intelligence:view"}, {name:"Administration",description:"Manage administrative identities, roles, status and security audit records.",href:"/admin/users",permission:"admin.users.read"},
];
export default async function AdminDashboard() {
  const context = await requireAdmin();
  const available = modules.filter((m) => !m.permission || context.permissions.has(m.permission));
  return <section className="space-y-8">
    <header className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000]"><p className="text-sm font-black uppercase tracking-[0.2em]">Secure operations control plane</p><h2 className="mt-2 text-4xl font-black uppercase">Dashboard</h2><p className="mt-3 max-w-2xl">Administrative actions run through existing canonical domain/application services. This dashboard does not create a second business-domain implementation.</p></header>
    <section aria-labelledby="available-modules"><h3 id="available-modules" className="mb-4 text-2xl font-black uppercase">Available modules</h3><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{available.map((module)=><Link key={module.href} href={module.href} className="border-4 border-black bg-[#f7d51d] p-5 shadow-[6px_6px_0_0_#000] hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-black"><h4 className="text-xl font-black uppercase">{module.name}</h4><p className="mt-2 text-sm">{module.description}</p></Link>)}</div></section>
    <section className="grid gap-5 sm:grid-cols-3"><div className="border-2 border-black bg-white p-4"><strong>Identity</strong><p className="mt-1 text-sm">{context.customer.email}</p></div><div className="border-2 border-black bg-white p-4"><strong>Roles</strong><p className="mt-1 text-sm">{[...context.roles].join(", ")}</p></div><div className="border-2 border-black bg-white p-4"><strong>Permissions</strong><p className="mt-1 text-sm">{context.permissions.size} granted</p></div></section>
  </section>;
}