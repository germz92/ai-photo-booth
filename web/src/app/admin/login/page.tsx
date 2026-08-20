import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { APP_NAME } from "@/lib/brand";
import { getUserAccount } from "@/lib/users";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

function safeCallback(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/admin";
  }
  return value;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const next = safeCallback(callbackUrl);
  if (session?.user?.id) {
    const account = await getUserAccount(session.user.id);
    if (account?.status === "active") redirect(next);
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <p className="text-xs tracking-[0.28em] uppercase text-accent">{APP_NAME}</p>
      <h1 className="page-title mt-3">Sign in</h1>
      <p className="mt-2 mb-8 text-sm text-muted">
        Sign in to manage your events and open your kiosk.
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
