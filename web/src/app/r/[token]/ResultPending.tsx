"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ResultPending() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-light tracking-[0.12em] uppercase">Still working</h1>
      <p className="mt-3 text-muted">Your portrait is still being generated. This page updates automatically.</p>
    </main>
  );
}
