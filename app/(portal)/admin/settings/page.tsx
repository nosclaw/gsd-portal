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
  const [workspaceDomain, setWorkspaceDomain] = useState("");
  const [portRangeStart, setPortRangeStart] = useState("30000");
  const [portRangeEnd, setPortRangeEnd] = useState("39999");
  const [defaultModel, setDefaultModel] = useState("arcee-ai/trinity-large-preview:free");
  const [defaultThinkingLevel, setDefaultThinkingLevel] = useState("minimal");
  const [gitPostBuffer, setGitPostBuffer] = useState("5242880000");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      setSettings(data.settings);
      setDevEnvRepo(data.settings?.dev_env_repo || "");
      setDevEnvBranch(data.settings?.dev_env_branch || "main");
      setDevEnvAutoInit(data.settings?.dev_env_auto_init !== false);
      setWorkspaceDomain(data.settings?.workspace_domain || "");
      setPortRangeStart(String(data.settings?.port_range_start || 30000));
      setPortRangeEnd(String(data.settings?.port_range_end || 39999));
      setDefaultModel(data.settings?.default_model || "arcee-ai/trinity-large-preview:free");
      setDefaultThinkingLevel(data.settings?.default_thinking_level || "minimal");
      setGitPostBuffer(String(data.settings?.git_post_buffer || 5242880000));
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
          dev_env_auto_init: devEnvAutoInit,
          workspace_domain: workspaceDomain || undefined,
          port_range_start: Number(portRangeStart) || 30000,
          port_range_end: Number(portRangeEnd) || 39999,
          default_model: defaultModel || "arcee-ai/trinity-large-preview:free",
          default_thinking_level: defaultThinkingLevel || "minimal",
          git_post_buffer: Number(gitPostBuffer) || 5242880000
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

              <div className="mt-4 border-t border-black/6 pt-5 dark:border-white/8">
                <p className="text-sm font-medium">Workspace domain</p>
                <p className="mt-1 text-xs text-muted">
                  Set the workspace domain. All users share one domain, distinguished by their auth token: <code className="rounded bg-black/5 px-1 dark:bg-white/8">{workspaceDomain || "gsd.example.com"}</code>
                </p>
                <div className="mt-3">
                  <TextField>
                    <Input
                      className="surface-soft rounded-xl"
                      placeholder="gsd.example.com"
                      value={workspaceDomain}
                      onChange={(e) => setWorkspaceDomain(e.target.value)}
                    />
                  </TextField>
                </div>
              </div>

              <div className="mt-4 border-t border-black/6 pt-5 dark:border-white/8">
                <p className="text-sm font-medium">Port range</p>
                <p className="mt-1 text-xs text-muted">
                  GSD workspace port allocation range (30000–39999).
                </p>
                <div className="mt-3 flex gap-3">
                  <TextField>
                    <Input
                      className="surface-soft rounded-xl"
                      placeholder="30000"
                      type="number"
                      value={portRangeStart}
                      onChange={(e) => setPortRangeStart(e.target.value)}
                    />
                  </TextField>
                  <span className="flex items-center text-muted">—</span>
                  <TextField>
                    <Input
                      className="surface-soft rounded-xl"
                      placeholder="39999"
                      type="number"
                      value={portRangeEnd}
                      onChange={(e) => setPortRangeEnd(e.target.value)}
                    />
                  </TextField>
                </div>
              </div>

              <div className="mt-4 border-t border-black/6 pt-5 dark:border-white/8">
                <p className="text-sm font-medium">Git http.postBuffer</p>
                <p className="mt-1 text-xs text-muted">
                  Max size for HTTP POST data in git operations (bytes). Default 5GB for large repos.
                </p>
                <div className="mt-3 w-48">
                  <TextField>
                    <Input
                      className="surface-soft rounded-xl font-mono text-sm"
                      type="number"
                      value={gitPostBuffer}
                      onChange={(e) => setGitPostBuffer(e.target.value)}
                    />
                  </TextField>
                </div>
              </div>

              <div className="mt-4 border-t border-black/6 pt-5 dark:border-white/8">
                <p className="text-sm font-medium">Default AI model</p>
                <p className="mt-1 text-xs text-muted">
                  Default model and thinking level for new user workspaces.
                </p>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted">Model</label>
                    <TextField>
                      <Input
                        className="surface-soft rounded-xl font-mono text-sm"
                        placeholder="arcee-ai/trinity-large-preview:free"
                        value={defaultModel}
                        onChange={(e) => setDefaultModel(e.target.value)}
                      />
                    </TextField>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted">Thinking level</label>
                    <div className="flex gap-2">
                      {["off", "minimal", "medium", "high"].map((level) => (
                        <button
                          key={level}
                          type="button"
                          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                            defaultThinkingLevel === level
                              ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                              : "bg-black/5 text-muted hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
                          }`}
                          onClick={() => setDefaultThinkingLevel(level)}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
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

