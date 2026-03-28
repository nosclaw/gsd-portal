"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
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
  ShieldCheck,
  Sparkles,
  UserRound,
  AlertCircle
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false
      });

      if (result?.error) {
        setError("Invalid credentials or account not approved.");
      } else {
        router.push("/");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="surface relative overflow-hidden p-8 sm:p-10 lg:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.12),transparent_24%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between gap-8">
            <div className="space-y-6">
              <span className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white dark:bg-white dark:text-slate-950">
                GSD Portal / access
              </span>
              <div className="space-y-4">
                <h1 className="max-w-xl font-[family-name:var(--font-display)] text-5xl tracking-tight sm:text-6xl">
                  Secure entry for every tenant, workspace and session.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted">
                  A private control surface for approvals, workspace launch and
                  session continuity. Designed with HeroUI, shaped by the
                  dashboard reference in `ui/design.png`.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Identity-aware commits",
                  body: "Inject Git author data so AI output remains attributable.",
                  icon: UserRound
                },
                {
                  title: "Refresh-token continuity",
                  body: "Keep GSD sessions alive without leaking raw credentials.",
                  icon: ShieldCheck
                },
                {
                  title: "Workspace orchestration",
                  body: "Launch, recover and audit each runtime from one shell.",
                  icon: Sparkles
                }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="surface-soft border-none shadow-none">
                    <CardContent className="gap-3 p-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-500 dark:bg-sky-500/18">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-semibold">{item.title}</h2>
                        <p className="mt-2 text-sm leading-7 text-muted">{item.body}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="surface flex items-center justify-center p-6 sm:p-10">
          <Card className="w-full max-w-xl border-none bg-transparent shadow-none">
            <CardHeader className="flex flex-col items-start gap-2 px-0 pb-6 pt-0">
              <p className="text-xs uppercase tracking-[0.28em] text-muted">Sign in</p>
              <h2 className="text-3xl font-semibold tracking-tight">Continue to your portal</h2>
              <p className="text-sm leading-7 text-muted">
                Sign in with your tenant credentials. Approval status, workspace
                access and admin actions are all enforced server-side.
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
                  <Label>Username</Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      className="h-12 w-full rounded-xl border border-black/10 pl-10 dark:border-white/10"
                      placeholder="avery"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </TextField>
                <TextField className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      className="h-12 w-full rounded-xl border border-black/10 pl-10 dark:border-white/10"
                      placeholder="••••••••"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </TextField>
                <Button
                  className="h-12 w-full rounded-full bg-sky-500 text-base font-semibold text-white shadow-lg shadow-sky-500/25"
                  type="submit"
                  isDisabled={loading}
                >
                  {loading ? "Signing in..." : "Sign in to Portal"}
                </Button>
              </form>
              <div className="h-px w-full bg-black/8 dark:bg-white/10" />
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                <span>
                  Don't have an account?{" "}
                  <Link href="/auth/register">Register</Link>
                </span>
                <Link href="/auth/reset-password" className="text-sm text-muted hover:text-slate-950 dark:hover:text-white">
                  Forgot password?
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
