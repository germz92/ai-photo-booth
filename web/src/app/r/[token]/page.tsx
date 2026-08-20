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
      <div className={`mt-8 grid gap-4 ${keys.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {keys.map((_, index) => {
          const src = `/api/r/${token}/image?i=${index}`;
          return (
            <div key={src} className="overflow-hidden rounded border border-white/10 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Generated portrait ${index + 1}`} className="w-full" />
              <a className="booth-button m-4 w-[calc(100%-2rem)]" href={src} download={`portrait-${index + 1}.png`}>
                Download {keys.length > 1 ? index + 1 : ""}
              </a>
            </div>
          );
        })}
      </div>
    </main>
  );
}
