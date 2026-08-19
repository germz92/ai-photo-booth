import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { normalizeEmail, promoteToSuperadmin } from "./users";

export async function ensureBootstrapAdmin() {
  const email = normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL || "");
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;

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
