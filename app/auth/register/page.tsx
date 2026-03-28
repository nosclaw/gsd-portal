"use client";

import { useState } from "react";
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
  Mail,
  UserRound,
  AlertCircle,
  UserPlus,
  ArrowLeft
} from "lucide-react";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, name, email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || data.error || "Registration failed.");
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
            <UserPlus className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Registration Submitted</h2>
          <p className="mt-4 text-muted">
            Your account has been created and is currently <strong>PENDING</strong> approval.
            Please contact your Tenant Admin to activate your access.
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
          <p className="text-xs uppercase tracking-[0.28em] text-muted">Join platform</p>
          <h2 className="text-3xl font-semibold tracking-tight">Create your account</h2>
          <p className="text-sm leading-7 text-muted">
            Register to request access to your team's GSD portal. All new accounts
            require manual approval by an administrator.
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
              <Label>Display Name *</Label>
              <Input
                className="h-12 w-full rounded-xl border border-black/10 dark:border-white/10"
                placeholder="Avery Palmer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </TextField>
            <TextField className="space-y-2">
              <Label>Username *</Label>
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
            <TextField className="space-y-2">
              <Label>Email *</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  className="h-12 w-full rounded-xl border border-black/10 pl-10 dark:border-white/10"
                  placeholder="avery@nosclaw.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </TextField>
            <TextField className="space-y-2">
              <Label>Password *</Label>
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
            <Button
              className="h-12 w-full rounded-full bg-slate-950 text-base font-semibold text-white dark:bg-white dark:text-slate-950"
              type="submit"
              isDisabled={loading}
            >
              {loading ? "Submitting..." : "Request Access"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
