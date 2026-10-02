import Link from "next/link";
import { requireAdmin } from "@/lib/admin/authorization";
import type { AdminPermission } from "@/lib/admin/permissions";
const modules: Array<{name:string;description:string;href:string;permission?:AdminPermission}> = [
  {name:"Catalog",description:"Existing catalog administration routes remain owned by the Catalog domain and are permission-protected.",href:"/admin/catalog",permission:"catalog.read"},
  {name:"Orders",description:"Order administration is reserved for a later module phase.",href:"/admin/orders",permission:"orders.read"},
  {name:"Fulfillment",description:"Fulfillment administration is reserved for a later module phase.",href:"/admin/fulfillment",permission:"fulfillment.read"},
  {name:"Shipping",description:"Shipping administration is reserved for a later module phase.",href:"/admin/shipping",permission:"shipping.read"},
  {name:"Returns",description:"Returns administration is reserved for a later module phase.",href:"/admin/returns",permission:"returns.read"},
  {name:"Customers",description:"Customer administration is reserved for a later module phase.",href:"/admin/customers",permission:"customers.read"},
  {name:"Cases",description:"Case administration from Phase 13.9 uses the centralized admin authorization boundary.",href:"/admin/cases",permission:"cases.read"},
  {name:"Analytics",description:"Analytics administration is reserved for a later module phase.",href:"/admin/analytics",permission:"analytics.read"},
  {name:"Administration",description:"Manage administrative identities, roles and security audit records.",href:"/admin/users",permission:"admin.users.read"},
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