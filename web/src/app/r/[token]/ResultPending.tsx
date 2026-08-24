"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ResultPending({ name }: { name?: string | null }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16 text-center sm:px-6">
      <h1 className="page-title">Still working</h1>
      <p className="mt-3 text-muted">
        {name ? `${name}, your` : "Your"} portrait is still being generated. This page updates automatically.
      </p>
    </main>
  );
}
