import { connection } from "next/server";
import { APP_NAME } from "@/lib/brand";
import { jobOutputKeys, linkExpired } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { ResultPending } from "./ResultPending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const job = await prisma.job.findUnique({ where: { resultToken: token } });

  if (!job) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16 text-center sm:px-6">
        <h1 className="page-title">Portrait not found</h1>
        <p className="mt-3 text-muted">This link is invalid.</p>
      </main>
    );
  }

  if (linkExpired(job.resultExpiresAt)) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16 text-center sm:px-6">
        <h1 className="page-title">This link has expired</h1>
        <p className="mt-3 text-muted">Portrait links are available for 48 hours.</p>
      </main>
    );
  }

  const keys = jobOutputKeys(job);
  if (job.status !== "complete" || !keys.length) {
    return <ResultPending />;
  }

  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-xs tracking-[0.28em] uppercase text-accent">{APP_NAME}</p>
      <h1 className="page-title mt-4">Your portrait</h1>
      <p className="mt-2 text-muted">Save your image{keys.length > 1 ? "s" : ""}. The link expires in 48 hours.</p>
      <p className="mt-3 flex items-start gap-2 text-sm text-white sm:items-center">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="mt-0.5 shrink-0 text-accent sm:mt-0"
        >
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none" />
        </svg>
        <span>On a phone, press and hold the photo, then tap Save Image.</span>
      </p>
      <div className={`mt-8 grid gap-4 ${keys.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {keys.map((_, index) => {
          const src = `/api/r/${token}/image?i=${index}&v=${job.updatedAt.getTime()}`;
          return (
            <div key={src} className="overflow-hidden rounded border border-white/10 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Generated portrait ${index + 1}`} className="w-full" />
              <a className="booth-button m-4 w-[calc(100%-2rem)]" href={src} download={`portrait-${index + 1}.png`}>
                Download {keys.length > 1 ? index + 1 : ""}
              </a>
              <p className="mb-4 flex items-center justify-center gap-2 px-4 text-center text-xs text-muted sm:hidden">
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  className="shrink-0 text-accent"
                >
                  <rect x="7" y="2" width="10" height="20" rx="2" />
                  <circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none" />
                </svg>
                Press and hold the photo, then tap Save Image.
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
