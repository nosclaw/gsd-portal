"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Card, CardContent, CardHeader, Input, TextField } from "@heroui/react";
import { Save } from "lucide-react";

import { CardSkeleton } from "@/components/shared/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [devEnvRepo, setDevEnvRepo] = useState("");
  const [devEnvBranch, setDevEnvBranch] = useState("main");
  const [devEnvAutoInit, setDevEnvAutoInit] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      setSettings(data.settings);
      setDevEnvRepo(data.settings?.dev_env_repo || "");
      setDevEnvBranch(data.settings?.dev_env_branch || "main");
      setDevEnvAutoInit(data.settings?.dev_env_auto_init !== false);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dev_env_repo: devEnvRepo || undefined,
          dev_env_branch: devEnvBranch || "main",
          dev_env_auto_init: devEnvAutoInit
        })
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description="Configure tenant-wide settings including developer environment initialization."
        eyebrow="Administration"
        title="Settings"
      />

      <Card className="surface">
        <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
          <p className="text-sm text-muted">Developer environment</p>
          <h3 className="text-2xl font-semibold tracking-tight">Dev-env setup</h3>
          <p className="text-sm text-muted">
            Configure the GitHub repository that initializes each developer&apos;s workspace on first launch.
          </p>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-6 pt-2">
          {loading ? (
            <CardSkeleton lines={3} />
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Repository URL</label>
                <TextField>
                  <Input
                    className="surface-soft rounded-xl"
                    placeholder="https://github.com/org/dev-env.git"
                    value={devEnvRepo}
                    onChange={(e) => setDevEnvRepo(e.target.value)}
                  />
                </TextField>
                <p className="text-xs text-muted">
                  Git clone URL. Will be cloned into each user&apos;s workspace on first launch.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <TextField>
                  <Input
                    className="surface-soft rounded-xl"
                    placeholder="main"
                    value={devEnvBranch}
                    onChange={(e) => setDevEnvBranch(e.target.value)}
                  />
                </TextField>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="auto-init"
                  className="h-4 w-4 rounded"
                  checked={devEnvAutoInit}
                  onChange={(e) => setDevEnvAutoInit(e.target.checked)}
                />
                <label htmlFor="auto-init" className="text-sm">
                  Auto-initialize on first workspace launch
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  className="rounded-full font-semibold"
                  variant="primary"
                  isDisabled={saving}
                  onPress={handleSave}
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save settings"}
                </Button>
                {saved && (
                  <span className="text-sm text-success">Settings saved.</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
