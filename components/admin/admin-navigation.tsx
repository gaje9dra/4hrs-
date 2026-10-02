"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNavigation({items,email,roles}:{items:Array<{label:string;href:string}>;email:string;roles:string[]}) {
 const pathname=usePathname();
 return <div className="border-4 border-black bg-[#f7d51d] p-4 shadow-[6px_6px_0_0_#000]">
  <div className="mb-4"><p className="text-xs font-black uppercase tracking-[0.2em]">4HRS+</p><h1 className="text-2xl font-black uppercase">Admin</h1><p className="mt-2 break-words text-sm font-bold">{email}</p><p className="text-xs">{roles.join(" · ")}</p></div>
  <nav aria-label="Administrative navigation" className="grid gap-2">{items.map(item=><Link key={item.href} href={item.href} aria-current={pathname===item.href?"page":undefined} className="border-2 border-black bg-white px-3 py-3 font-bold uppercase focus-visible:outline-4 focus-visible:outline-black">{item.label}</Link>)}</nav>
 </div>;
}
