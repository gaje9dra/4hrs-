import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import type { AdminPermission } from "@/lib/admin/permissions";

const nav: Array<{label:string;href:string;permission?:AdminPermission}> = [
  {label:"Dashboard",href:"/admin"},
  {label:"Catalog",href:"/admin/catalog",permission:"catalog.read"},
  {label:"Orders",href:"/admin/orders",permission:"orders.read"},
  {label:"Fulfillment",href:"/admin/fulfillment",permission:"fulfillment.read"},
  {label:"Shipping",href:"/admin/shipping",permission:"shipping.read"},
  {label:"Returns",href:"/admin/returns",permission:"returns.read"},
  {label:"Customers",href:"/admin/customers",permission:"customers.read"},
  {label:"Cases",href:"/admin/cases",permission:"cases.read"},
  {label:"Analytics",href:"/admin/analytics",permission:"analytics.read"},
  {label:"Administration",href:"/admin/users",permission:"admin.users.read"},
  {label:"Audit log",href:"/admin/audit",permission:"admin.audit.read"},
];

export default async function AdminLayout({children}:{children:React.ReactNode}) {
  let context;
  try { context = await requireAdmin(); }
  catch (error) {
    if (error instanceof AdminError && error.code === "ADMIN_REQUIRED") redirect("/login?next=/admin");
    throw error;
  }
  const visible = nav.filter((item) => !item.permission || context.permissions.has(item.permission));
  return (
    <div className="min-h-screen border-t-4 border-black bg-[#f4efe3] text-black">
      <div className="mx-auto grid min-h-screen max-w-7xl md:grid-cols-[240px_1fr]">
        <aside className="border-b-4 border-black bg-[#f4efe3] p-4 md:border-b-0 md:border-r-4">
          <div className="mb-6 border-4 border-black bg-[#f7d51d] p-4 shadow-[6px_6px_0_0_#000]">
            <p className="text-xs font-black uppercase tracking-[0.2em]">4HRS+</p>
            <h1 className="text-2xl font-black uppercase">Admin</h1>
          </div>
          <nav aria-label="Administrative navigation" className="grid gap-2">
            {visible.map((item) => (
              <Link key={item.href} href={item.href} className="border-2 border-black bg-white px-3 py-3 font-bold uppercase hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#f7d51d]">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 border-2 border-black bg-white p-3 text-sm">
            <p className="font-bold">{context.customer.email}</p>
            <p>{[...context.roles].join(" · ")}</p>
          </div>
          <form action="/api/auth/logout" method="post" className="mt-3">
            <button className="w-full border-2 border-black bg-black px-3 py-3 font-bold uppercase text-white" type="submit">Log out</button>
          </form>
        </aside>
        <main id="main-content" className="p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}