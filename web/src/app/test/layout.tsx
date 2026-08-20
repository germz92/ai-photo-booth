import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureBootstrapAdmin } from "@/lib/auth-bootstrap";
import { getUserAccount } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function TestLayout({ children }: { children: React.ReactNode }) {
  await ensureBootstrapAdmin();
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/admin/login?callbackUrl=/test");
  }
  const account = await getUserAccount(session.user.id);
  if (!account || account.status !== "active") {
    redirect("/admin/login");
  }
  return children;
}
