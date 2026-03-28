"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  Link,
  TextField
} from "@heroui/react";
import {
  LockKeyhole,
  UserRound,
  AlertCircle,
  ArrowLeft,
  CheckCircle2
} from "lucide-react";

function SetNewPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to reset password.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="surface w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Password Reset</h2>
          <p className="mt-4 text-muted">
            Your password has been updated successfully. You can now sign in with your new password.
          </p>
          <Link
            href="/auth/sign-in"
            className="mt-8 inline-block rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
          >
            Back to Sign In
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="surface w-full max-w-xl p-8">
        <CardHeader className="flex flex-col items-start gap-2 px-0 pb-6 pt-0">
          <Link
            href="/auth/sign-in"
            className="mb-4 flex items-center gap-2 text-sm text-muted hover:text-slate-950 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
          <p className="text-xs uppercase tracking-[0.28em] text-muted">Reset password</p>
          <h2 className="text-3xl font-semibold tracking-tight">Set new password</h2>
          <p className="text-sm leading-7 text-muted">
            Enter your new password below. Must be at least 8 characters.
          </p>
        </CardHeader>
        <CardContent className="gap-5 px-0 pb-0 pt-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-danger-50 p-4 text-sm text-danger dark:bg-danger-900/10">
                <AlertCircle className="h-4 w-4" />
                <p>{error}</p>
              </div>
            )}
            <TextField className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  className="h-12 w-full rounded-xl border border-black/10 pl-10 dark:border-white/10"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </TextField>
            <TextField className="space-y-2">
              <Label>Confirm Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  className="h-12 w-full rounded-xl border border-black/10 pl-10 dark:border-white/10"
                  placeholder="••••••••"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
            </TextField>
            <Button
              className="h-12 w-full rounded-full bg-slate-950 text-base font-semibold text-white dark:bg-white dark:text-slate-950"
              type="submit"
              isDisabled={loading}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function RequestResetForm() {
  const [username, setUsername] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="surface w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-sky-500 dark:bg-sky-500/10">
            <LockKeyhole className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Password Reset</h2>
          <p className="mt-4 text-muted">
            Please contact your administrator to receive a password reset link for <strong>@{username}</strong>.
          </p>
          <Link
            href="/auth/sign-in"
            className="mt-8 inline-block rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
          >
            Back to Sign In
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="surface w-full max-w-xl p-8">
        <CardHeader className="flex flex-col items-start gap-2 px-0 pb-6 pt-0">
          <Link
            href="/auth/sign-in"
            className="mb-4 flex items-center gap-2 text-sm text-muted hover:text-slate-950 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
          <p className="text-xs uppercase tracking-[0.28em] text-muted">Forgot password</p>
          <h2 className="text-3xl font-semibold tracking-tight">Reset your password</h2>
          <p className="text-sm leading-7 text-muted">
            Enter your username below and we'll guide you through the reset process.
          </p>
        </CardHeader>
        <CardContent className="gap-5 px-0 pb-0 pt-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField className="space-y-2">
              <Label>Username</Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  className="h-12 w-full rounded-xl border border-black/10 pl-10 dark:border-white/10"
                  placeholder="avery"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </TextField>
            <Button
              className="h-12 w-full rounded-full bg-slate-950 text-base font-semibold text-white dark:bg-white dark:text-slate-950"
              type="submit"
            >
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (token) {
    return <SetNewPasswordForm token={token} />;
  }

  return <RequestResetForm />;
}
