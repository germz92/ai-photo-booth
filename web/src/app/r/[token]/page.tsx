import { connection } from "next/server";
import { linkExpired } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { objectUrl } from "@/lib/storage";

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
      <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-medium">Portrait not found</h1>
        <p className="mt-3 text-muted">This link is invalid.</p>
      </main>
    );
  }

  if (linkExpired(job.resultExpiresAt)) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-medium">This link has expired</h1>
        <p className="mt-3 text-muted">Portrait links are available for 48 hours.</p>
      </main>
    );
  }

  if (job.status !== "complete" || !job.outputKey) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-medium">Still working</h1>
        <p className="mt-3 text-muted">Refresh in a moment. Your portrait is still being generated.</p>
      </main>
    );
  }

  const remote = await objectUrl(job.outputKey);
  const src = remote || `/api/r/${token}/image`;

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col px-6 py-12">
      <p className="text-xs tracking-[0.28em] uppercase text-accent">AI Photo Booth</p>
      <h1 className="mt-4 text-3xl font-medium tracking-tight">Your portrait</h1>
      <p className="mt-2 text-muted">Save this image. The link expires in 48 hours.</p>
      <div className="mt-8 overflow-hidden rounded-sm ring-1 ring-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Generated portrait" className="w-full bg-black" />
      </div>
      <a className="booth-button mt-8 self-start" href={src} download="portrait.jpg">
        Download
      </a>
    </main>
  );
}
