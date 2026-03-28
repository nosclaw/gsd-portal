"use client";

import { useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@heroui/react";
import { useIdleTimeout } from "@/lib/use-idle-timeout";

export function SessionTimeoutGuard() {
  const [showWarning, setShowWarning] = useState(false);

  const onWarning = useCallback(() => {
    setShowWarning(true);
  }, []);

  const onTimeout = useCallback(() => {
    signOut({ callbackUrl: "/auth/sign-in" });
  }, []);

  const { resetTimer } = useIdleTimeout({ onWarning, onTimeout });

  const handleStaySignedIn = () => {
    setShowWarning(false);
    resetTimer();
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/auth/sign-in" });
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="surface mx-4 w-full max-w-md rounded-2xl p-8 text-center shadow-xl">
        <h2 className="text-xl font-semibold tracking-tight">Session Expiring</h2>
        <p className="mt-3 text-sm text-muted">
          You've been inactive for a while. Your session will expire soon for security.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            className="rounded-full"
            variant="ghost"
            onPress={handleSignOut}
          >
            Sign out
          </Button>
          <Button
            className="rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/25"
            onPress={handleStaySignedIn}
          >
            Stay signed in
          </Button>
        </div>
      </div>
    </div>
  );
}
