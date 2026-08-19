import { APP_NAME } from "@/lib/brand";
import { AcceptInviteForm } from "./AcceptInviteForm";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <p className="text-xs tracking-[0.28em] uppercase text-accent">{APP_NAME}</p>
      <h1 className="mt-3 text-3xl font-light tracking-[0.12em] uppercase">Accept invite</h1>
      <p className="mt-2 mb-8 text-sm text-muted">Set a password to activate your account.</p>
      <AcceptInviteForm token={token} />
    </main>
  );
}
