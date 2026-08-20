import bcrypt from "bcryptjs";
import { prisma, repairAdminUserDateFields } from "./prisma";
import { normalizeEmail, promoteToSuperadmin } from "./users";

function duringProductionBuild() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export async function ensureBootstrapAdmin() {
  if (duringProductionBuild()) return;

  const email = normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL || "");
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;

  await repairAdminUserDateFields();

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    await promoteToSuperadmin(existing.id, { grantCreditsIfMissing: true });
    return;
  }

  const count = await prisma.adminUser.count();
  if (count > 0) return;

  const created = await prisma.adminUser.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  await promoteToSuperadmin(created.id, { grantCreditsIfMissing: true });
}
