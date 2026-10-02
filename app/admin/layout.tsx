import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import type { AdminPermission } from "@/lib/admin/permissions";
import { AdminNavigation } from "@/components/admin/admin-navigation";

const nav: Array<{ label: string; href: string; permission?: AdminPermission }> = [
  { label: "Dashboard", href: "/admin" },
  { label: "Catalog", href: "/admin/catalog", permission: "catalog.read" },
  { label: "Cases", href: "/admin/cases", permission: "cases.read" },
  { label: "Administration", href: "/admin/users", permission: "admin.users.read" },
  { label: "Audit log", href: "/admin/audit", permission: "admin.audit.read" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let context;
  try { context = await requireAdmin(); }
  catch (error) {
    if (error instanceof AdminError && error.code === "ADMIN_REQUIRED") redirect("/login?next=/admin");
    throw error;
  }
  const links = nav
    .filter((item) => !item.permission || context.permissions.has(item.permission))
    .map(({ label, href }) => ({ label, href }));

  return (
    <div className="min-h-screen border-t-4 border-black bg-[#f4efe3] text-black">
      <div className="mx-auto min-h-screen max-w-7xl md:grid md:grid-cols-[240px_1fr]">
        <aside className="hidden border-black bg-[#f4efe3] p-4 md:block md:border-r-4">
          <div className="sticky top-4">
            <div className="mb-6 border-4 border-black bg-[#f7d51d] p-4 shadow-[6px_6px_0_0_#000]">
              <p className="text-xs font-black uppercase tracking-[0.2em]">4HRS+</p>
              <h1 className="text-2xl font-black uppercase">Admin</h1>
            </div>
            <nav aria-label="Administrative navigation" className="grid gap-2">
              {links.map((item) => (
                <Link key={item.href} href={item.href} className="border-2 border-black bg-white px-3 py-3 font-bold uppercase hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#f7d51d]">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-6 border-2 border-black bg-white p-3 text-sm">
              <p className="break-words font-bold">{context.customer.email}</p>
              <p>{[...context.roles].join(" · ")}</p>
            </div>
            <form action="/api/auth/logout" method="post" className="mt-3">
              <button className="w-full border-2 border-black bg-black px-3 py-3 font-bold uppercase text-white focus-visible:outline-4 focus-visible:outline-[#f7d51d]" type="submit">Log out</button>
            </form>
          </div>
        </aside>
        <div className="min-w-0">
          <div className="p-4 md:hidden">
            <AdminNavigation items={links} email={context.customer.email} roles={[...context.roles]} />
            <form action="/api/auth/logout" method="post" className="mt-3">
              <button className="w-full border-2 border-black bg-black px-3 py-3 font-bold uppercase text-white focus-visible:outline-4 focus-visible:outline-[#f7d51d]" type="submit">Log out</button>
            </form>
          </div>
          <main id="main-content" className="min-w-0 p-5 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
