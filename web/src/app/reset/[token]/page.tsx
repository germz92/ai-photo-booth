import { APP_NAME } from "@/lib/brand";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <p className="text-xs tracking-[0.28em] uppercase text-accent">{APP_NAME}</p>
      <h1 className="page-title mt-3">Reset password</h1>
      <p className="mt-2 mb-8 text-sm text-muted">Choose a new password, then sign in.</p>
      <ResetPasswordForm token={token} />
    </main>
  );
}
