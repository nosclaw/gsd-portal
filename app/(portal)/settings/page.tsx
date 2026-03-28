"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Card, CardContent, CardHeader, Input, TextField } from "@heroui/react";
import { GitBranch, Lock, Save } from "lucide-react";

import { CardSkeleton } from "@/components/shared/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";

export default function UserSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [gitUsername, setGitUsername] = useState("");
  const [gitEmail, setGitEmail] = useState("");
  const [githubPat, setGithubPat] = useState("");
  const [hasGithubPat, setHasGithubPat] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/user/settings");
      const data = await res.json();
      setGitUsername(data.gitUsername || "");
      setGitEmail(data.gitEmail || "");
      setHasGithubPat(data.hasGithubPat || false);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const body: any = { gitUsername, gitEmail };
      if (githubPat) body.githubPat = githubPat;
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setSaved(true);
        setGithubPat("");
        if (githubPat) setHasGithubPat(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePat = async () => {
    setSaving(true);
    try {
      await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubPat: "" })
      });
      setHasGithubPat(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description="Configure your Git identity and GitHub access for code commits."
        eyebrow="Settings"
        title="Profile settings"
      />

      <Card className="surface">
        <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
          <p className="text-sm text-muted">Git identity</p>
          <h3 className="text-2xl font-semibold tracking-tight">Commit attribution</h3>
          <p className="text-sm text-muted">
            These values are used as Git author/committer for all commits in your workspace.
          </p>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-6 pt-2">
          {loading ? <CardSkeleton lines={3} /> : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Git username</label>
                <TextField>
                  <Input
                    className="surface-soft rounded-xl"
                    placeholder="Your Name"
                    value={gitUsername}
                    onChange={(e) => setGitUsername(e.target.value)}
                  />
                </TextField>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Git email</label>
                <TextField>
                  <Input
                    className="surface-soft rounded-xl"
                    placeholder="you@example.com"
                    value={gitEmail}
                    onChange={(e) => setGitEmail(e.target.value)}
                  />
                </TextField>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="surface">
        <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            <p className="text-sm text-muted">GitHub</p>
          </div>
          <h3 className="text-2xl font-semibold tracking-tight">Access token</h3>
          <p className="text-sm text-muted">
            A Personal Access Token (PAT) allows GSD to push commits to GitHub on your behalf.
            Create one at{" "}
            <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener" className="text-primary underline">
              github.com/settings/tokens
            </a>{" "}
            with <code className="rounded bg-black/5 px-1 dark:bg-white/10">repo</code> scope.
          </p>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-6 pt-2">
          {loading ? <CardSkeleton lines={2} /> : (
            <>
              <div className="surface-soft rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Token status</p>
                    <p className="mt-1 text-xs text-muted">
                      {hasGithubPat ? "Token configured — GitHub push enabled" : "Not configured — GitHub push disabled"}
                    </p>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${hasGithubPat ? "bg-emerald-500" : "bg-amber-500"}`} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{hasGithubPat ? "Replace token" : "Personal Access Token"}</label>
                <TextField>
                  <Input
                    className="surface-soft rounded-xl font-mono"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    type="password"
                    value={githubPat}
                    onChange={(e) => setGithubPat(e.target.value)}
                  />
                </TextField>
              </div>

              {hasGithubPat && (
                <Button
                  className="rounded-full text-sm"
                  variant="danger-soft"
                  size="sm"
                  onPress={handleRemovePat}
                  isDisabled={saving}
                >
                  Remove token
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          className="rounded-full font-semibold"
          variant="primary"
          isDisabled={saving || loading}
          onPress={handleSave}
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save settings"}
        </Button>
        {saved && <span className="text-sm text-success">Settings saved. Restart workspace to apply.</span>}
      </div>

      <PasswordCard />
    </div>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const isValid = currentPassword && newPassword.length >= 6 && passwordsMatch;

  const handleChangePassword = async () => {
    if (!isValid) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Password changed successfully." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to change password." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="surface">
      <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          <p className="text-sm text-muted">Security</p>
        </div>
        <h3 className="text-2xl font-semibold tracking-tight">Change password</h3>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-6 pt-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Current password</label>
          <TextField>
            <Input
              className="surface-soft rounded-xl"
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </TextField>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">New password</label>
          <TextField>
            <Input
              className="surface-soft rounded-xl"
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </TextField>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Confirm new password</label>
          <TextField>
            <Input
              className={`surface-soft rounded-xl ${confirmPassword && !passwordsMatch ? "border-2 border-red-400" : ""}`}
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </TextField>
          {confirmPassword && !passwordsMatch && (
            <p className="text-xs text-danger">Passwords do not match.</p>
          )}
        </div>

        {message && (
          <p className={`text-sm ${message.type === "success" ? "text-success" : "text-danger"}`}>
            {message.text}
          </p>
        )}

        <Button
          className="rounded-full font-semibold"
          variant="primary"
          isDisabled={!isValid || saving}
          onPress={handleChangePassword}
        >
          {saving ? "Changing..." : "Change password"}
        </Button>
      </CardContent>
    </Card>
  );
}
