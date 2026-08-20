import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { APP_NAME } from "@/lib/brand";
import { ensureBootstrapAdmin } from "@/lib/auth-bootstrap";
import { getUserAccount } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureBootstrapAdmin();
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/admin/login");
  }
  const account = await getUserAccount(session.user.id);
  if (!account || account.status !== "active") {
    await signOut({ redirectTo: "/admin/login" });
    redirect("/admin/login");
  }

  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
        <a href="/admin" className="text-xs tracking-[0.28em] uppercase text-accent">
          {APP_NAME}
        </a>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>{account.email}</span>
          <span>{account.credits} credits</span>
          {account.role === "superadmin" ? (
            <a className="underline" href="/admin/users">
              Users
            </a>
          ) : null}
          <a className="underline" href="/test">
            Test lab
          </a>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/admin/login" });
            }}
          >
            <button type="submit" className="underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
