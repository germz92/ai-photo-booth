"use client";

import { useState } from "react";

export function ClientGalleryLink({ eventId }: { eventId: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/g/${eventId}`;

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <a className="booth-button-secondary inline-flex min-h-11 w-full items-center justify-center px-4 text-xs sm:w-auto" href={path} target="_blank" rel="noreferrer">
        Open gallery
      </a>
      <button
        type="button"
        className="booth-button-secondary min-h-11 w-full px-4 text-xs sm:w-auto"
        onClick={() => {
          const url = `${window.location.origin}${path}`;
          void navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
