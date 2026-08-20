import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { APP_NAME } from "@/lib/brand";
import { ensureBootstrapAdmin } from "@/lib/auth-bootstrap";
import { getUserAccount } from "@/lib/users";

export const dynamic = "force-dynamic";

async function signOutAdmin() {
  "use server";
  await signOut({ redirectTo: "/admin/login" });
}

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
    redirect("/admin/login");
  }

  function accountLinks() {
    return (
      <>
        {account.role === "superadmin" ? (
          <a className="underline" href="/admin/users">
            Users
          </a>
        ) : null}
        <a className="underline" href="/test">
          Test lab
        </a>
        <form action={signOutAdmin}>
          <button type="submit" className="underline">
            Sign out
          </button>
        </form>
      </>
    );
  }

  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-6 sm:py-4">
        <a href="/admin" className="shrink-0 text-xs tracking-[0.28em] uppercase text-accent">
          {APP_NAME}
        </a>
        <div className="hidden min-w-0 items-center gap-4 text-sm text-muted md:flex">
          <span className="truncate">{account.email}</span>
          <span className="shrink-0">{account.credits} credits</span>
          {accountLinks()}
        </div>
        <div className="flex min-w-0 items-center gap-3 md:hidden">
          <span className="shrink-0 text-sm text-muted">{account.credits} credits</span>
          <details className="admin-menu">
            <summary>Account</summary>
            <div className="admin-menu-panel text-sm text-muted">
              <p className="truncate text-foreground">{account.email}</p>
              {accountLinks()}
            </div>
          </details>
        </div>
      </header>
      {children}
    </div>
  );
}
