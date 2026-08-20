import { APP_NAME } from "@/lib/brand";
import { AcceptInviteForm } from "./AcceptInviteForm";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <p className="text-xs tracking-[0.28em] uppercase text-accent">{APP_NAME}</p>
      <h1 className="page-title mt-3">Accept invite</h1>
      <p className="mt-2 mb-8 text-sm text-muted">Set a password to activate your account.</p>
      <AcceptInviteForm token={token} />
    </main>
  );
}
