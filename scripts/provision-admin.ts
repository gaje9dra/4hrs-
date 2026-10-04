import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { ADMIN_ROLES, isAdminRoleName } from "@/lib/admin/permissions";
import { isPermanentSuperAdminEmail } from "@/lib/admin/protected";

const email = (process.env.ADMIN_PROVISION_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PROVISION_PASSWORD ?? "";
const permanentSuperAdmin = isPermanentSuperAdminEmail(email);
const role = permanentSuperAdmin ? "SUPER_ADMIN" : (process.env.ADMIN_PROVISION_ROLE ?? "VIEWER").trim().toUpperCase();

if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("ADMIN_PROVISION_EMAIL is required and must be a valid email.");
if (password.length < 12) throw new Error("ADMIN_PROVISION_PASSWORD must be at least 12 characters.");
if (!isAdminRoleName(role) || !ADMIN_ROLES.includes(role)) throw new Error("ADMIN_PROVISION_ROLE is invalid.");

async function main() {
  await db.$transaction(async (tx) => {
    let customer = await tx.customer.findUnique({ where: { email } });
    if (!customer) {
      const passwordHash = await hashPassword(password);
      customer = await tx.customer.create({ data: { email, status: "ACTIVE", credential: { create: { passwordHash } } } });
    } else {
      if (customer.status !== "ACTIVE") throw new Error("The customer account is not active.");
      const credential = await tx.customerCredential.findUnique({ where: { customerId: customer.id } });
      if (!credential) {
        const passwordHash = await hashPassword(password);
        await tx.customerCredential.create({ data: { customerId: customer.id, passwordHash } });
      }
    }
    const existing = await tx.adminUser.findUnique({ where: { customerId: customer.id } });
    if (existing) {
      if (!permanentSuperAdmin) throw new Error("This customer already has an administrator account.");
      const roleRow = await tx.adminRole.findUnique({ where: { name: "SUPER_ADMIN" } });
      if (!roleRow) throw new Error("The SUPER_ADMIN role is not seeded.");
      await tx.adminUser.update({ where: { id: existing.id }, data: { status: "ACTIVE", version: { increment: 1 }, roles: { deleteMany: {}, create: { roleId: roleRow.id } } } });
      return;
    }
    const roleRow = await tx.adminRole.findUnique({ where: { name: role } });
    if (!roleRow) throw new Error("The requested administrative role is not seeded.");
    await tx.adminUser.create({ data: { customerId: customer.id, roles: { create: { roleId: roleRow.id } } } });
  });

  console.log(`Administrator provisioned for ${email} with role ${role}. No password or secret was printed.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
