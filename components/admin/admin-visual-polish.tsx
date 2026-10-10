"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Applies shared admin polish while leaving the catalog route's presentation untouched. */
export function AdminVisualPolish({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="admin-polish-surface" data-admin-polish-route={pathname}>{children}</div>;
}
