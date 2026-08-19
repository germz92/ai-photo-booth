import { auth } from "@/auth";
import { ensureBootstrapAdmin } from "./auth-bootstrap";

export async function requireAdmin() {
  await ensureBootstrapAdmin();
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  return session;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
