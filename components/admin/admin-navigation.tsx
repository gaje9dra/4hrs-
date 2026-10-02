"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavItem = { label: string; href: string };

export function AdminNavigation({ items, email, roles }: { items: AdminNavItem[]; email: string; roles: string[] }) {
  const pathname = usePathname();
  return (
    <details className="group border-2 border-black bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 font-black uppercase focus-visible:outline-4 focus-visible:outline-[#f7d51d]">
        <span className="group-open:hidden">Open admin navigation</span>
        <span className="hidden group-open:inline">Close admin navigation</span>
      </summary>
      <div className="border-t-2 border-black p-3">
        <nav aria-label="Administrative navigation" className="grid gap-2">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={active ? "border-2 border-black bg-[#f7d51d] px-3 py-3 font-black uppercase" : "border-2 border-black bg-white px-3 py-3 font-bold uppercase"}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-3 border-2 border-black bg-[#f4efe3] p-3 text-sm">
          <p className="break-words font-bold">{email}</p>
          <p>{roles.join(" · ")}</p>
        </div>
      </div>
    </details>
  );
}
