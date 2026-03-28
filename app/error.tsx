"use client";

import { Button } from "@heroui/react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger dark:bg-danger-900/10">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Something went wrong</h2>
          <p className="text-sm text-muted">
            {error.message || "An unexpected error occurred."}
          </p>
        </div>
        <Button
          className="rounded-full font-semibold"
          variant="primary"
          onPress={reset}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
