"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-[var(--void)] flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-semibold text-[var(--cream)] mb-4">
            Something broke
          </h1>
          <p className="font-mono text-sm text-[var(--muted)] mb-6">
            Probably our fault. This stuff is hard, ok?
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 font-mono text-sm bg-[var(--coral)] text-[var(--void)] rounded-lg hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
