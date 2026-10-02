import { requireAdmin } from "@/lib/admin/authorization";
import { getAdminUser } from "@/lib/admin/application";
export default async function AdminUserDetail({params}:{params:Promise<{adminId:string}>}) {
  await requireAdmin(undefined, "admin.users.read");
  const user = await getAdminUser((await params).adminId);
  return <section className="space-y-5"><header><p className="text-sm font-black uppercase">Administrator</p><h2 className="text-4xl font-black">{user.email}</h2></header><div className="grid gap-3 border-4 border-black bg-white p-5 sm:grid-cols-2"><div><strong>Status</strong><p>{user.status}</p></div><div><strong>Roles</strong><p>{user.roles.join(", ")}</p></div><div><strong>Version</strong><p>{user.version}</p></div><div><strong>Last login</strong><p>{user.lastLoginAt ?? "Never recorded"}</p></div></div><p className="text-sm">Authorization changes require the protected administrator API, the current version, and a server-side audit record.</p></section>;
}