"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Separator
} from "@heroui/react";
import { ArrowDownToLine, Check, ExternalLink, Play, Power, RotateCw } from "lucide-react";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CardSkeleton } from "@/components/shared/page-skeleton";
import { StatusChip } from "@/components/shared/status-chip";
import { WorkspaceStatus } from "@/lib/types";

type ActionType = "launch" | "stop" | "restart" | null;

export function WorkspaceOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [error, setError] = useState<string | null>(null);
  const [devEnv, setDevEnv] = useState<any>(null);
  const [devEnvUpdating, setDevEnvUpdating] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces/status");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to fetch workspace status.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDevEnv = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces/dev-env/status");
      const json = await res.json();
      setDevEnv(json);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchDevEnv();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchDevEnv]);

  const handleDevEnvUpdate = async () => {
    setDevEnvUpdating(true);
    try {
      const res = await fetch("/api/workspaces/dev-env/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "Failed to update dev-env.");
      } else {
        toast.success("Dev environment updated");
      }
      await fetchDevEnv();
    } catch {
      toast.error("Network error while updating dev-env.");
    } finally {
      setDevEnvUpdating(false);
    }
  };

  const handleAction = async (action: ActionType) => {
    if (!action) return;

    if (action === "stop") {
      const confirmed = window.confirm("Are you sure you want to stop the workspace?");
      if (!confirmed) return;
    }

    setActiveAction(action);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || `Failed to ${action} workspace.`);
      } else {
        toast.success(`Workspace ${action} initiated`);
      }
    } catch {
      toast.error(`Network error while trying to ${action} workspace.`);
    } finally {
      await fetchStatus();
      setActiveAction(null);
    }
  };

  if (loading) {
    return (
      <Card className="surface p-6">
        <CardSkeleton lines={4} />
      </Card>
    );
  }

  const { instance, session, workspaceUrl, idleTimeoutAt } = data;
  const isRunning = instance?.status === WorkspaceStatus.RUNNING;
  const isLaunching = [WorkspaceStatus.STARTING, WorkspaceStatus.PREPARING, WorkspaceStatus.INITIALIZING, WorkspaceStatus.SPAWNING].includes(instance?.status);
  const isStarting = isLaunching;
  const displayUrl = workspaceUrl || (isRunning ? `${window.location.hostname}:${instance.port}` : null);

  // Idle timeout warning (< 5 minutes remaining)
  const idleWarning = isRunning && idleTimeoutAt && (idleTimeoutAt - Date.now() < 5 * 60 * 1000);
  const minutesLeft = idleTimeoutAt ? Math.max(0, Math.ceil((idleTimeoutAt - Date.now()) / 60000)) : 0;

  // Launch progress steps
  const LAUNCH_STEPS = [
    { key: WorkspaceStatus.PREPARING, label: "Preparing directory" },
    { key: WorkspaceStatus.INITIALIZING, label: "Initializing dev-env" },
    { key: WorkspaceStatus.SPAWNING, label: "Starting GSD" },
    { key: WorkspaceStatus.RUNNING, label: "Ready" }
  ];
  const currentStepIndex = LAUNCH_STEPS.findIndex((s) => s.key === instance?.status);

  return (
    <Card className="surface">
      <CardHeader className="flex items-center justify-between p-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted">Active instance</p>
          <h3 className="text-2xl font-semibold tracking-tight">
            GSD Workspace
          </h3>
        </div>
        <StatusChip status={instance?.status || WorkspaceStatus.STOPPED} />
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6 pt-0">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-danger-50 p-4 text-sm text-danger dark:bg-danger-900/10">
            <p>{error}</p>
          </div>
        )}

        {isRunning && idleWarning && (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/10 dark:text-amber-300">
            Workspace will be stopped due to inactivity in {minutesLeft} minute{minutesLeft !== 1 ? "s" : ""}.
          </div>
        )}

        {isLaunching && currentStepIndex >= 0 && (
          <div className="space-y-3">
            {LAUNCH_STEPS.map((step, i) => {
              const isDone = i < currentStepIndex;
              const isActive = i === currentStepIndex;
              return (
                <div key={step.key} className="flex items-center gap-3 text-sm">
                  <div className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    isDone ? "bg-emerald-500 text-white" :
                    isActive ? "bg-sky-500 text-white animate-pulse" :
                    "bg-black/5 text-muted dark:bg-white/8"
                  )}>
                    {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={cn(
                    isActive ? "font-medium" : isDone ? "text-muted" : "text-muted/60"
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="surface-soft p-4">
              <p className="text-xs uppercase tracking-wider text-muted">
                Runtime endpoint
              </p>
              <div className="mt-1 flex items-center justify-between">
                <p className="font-mono font-medium">
                  {displayUrl || "Not assigned"}
                </p>
                {isRunning && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    onPress={async () => {
                      const win = window.open("", "_blank");
                      const res = await fetch("/api/workspaces/open");
                      const json = await res.json();
                      if (json?.data?.url && win) win.location.href = json.data.url;
                      else win?.close();
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="surface-soft p-4">
              <p className="text-xs uppercase tracking-wider text-muted">
                Session validity
              </p>
              <p className="mt-1 font-medium">
                {session
                  ? `Expires at ${new Date(session.expiresAt).toLocaleTimeString()}`
                  : "No active session"}
              </p>
            </div>

            <div className="surface-soft p-4">
              <p className="text-xs uppercase tracking-wider text-muted">
                Process ID
              </p>
              <p className="mt-1 font-mono font-medium">
                {instance?.pid || "-"}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-end gap-3">
            {!isRunning && !isStarting ? (
              <Button
                className="h-12 rounded-full font-semibold"
                variant="primary"
                isDisabled={activeAction === "launch"}
                onPress={() => handleAction("launch")}
              >
                {activeAction === "launch" ? "Launching..." : "Launch workspace"}
                <Play className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  className="h-12 rounded-full font-semibold"
                  variant="secondary"
                  isDisabled={activeAction !== null}
                  onPress={() => handleAction("restart")}
                >
                  {activeAction === "restart" ? "Restarting..." : "Restart workspace"}
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button
                  className="h-12 rounded-full font-semibold"
                  variant="danger-soft"
                  isDisabled={activeAction !== null}
                  onPress={() => handleAction("stop")}
                >
                  {activeAction === "stop" ? "Stopping..." : "Stop instance"}
                  <Power className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <Separator className="opacity-50" />

        {devEnv?.configured && (
          <div>
            <p className="text-sm font-medium text-muted">Dev environment</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Repository</span>
                <span className="max-w-[200px] truncate font-mono text-xs">{devEnv.repo?.replace("https://github.com/", "").replace(".git", "")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Branch</span>
                <span className="font-mono">{devEnv.branch}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Version</span>
                <span className="font-mono">{devEnv.currentCommit || "Not installed"}</span>
              </div>
              {devEnv.updatedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Last updated</span>
                  <span>{new Date(devEnv.updatedAt).toLocaleString()}</span>
                </div>
              )}
              {devEnv.installed && (
                <div className="mt-3">
                  <Button
                    className="w-full rounded-full font-semibold"
                    size="sm"
                    variant={devEnv.updateAvailable ? "primary" : "outline"}
                    isDisabled={devEnvUpdating}
                    onPress={handleDevEnvUpdate}
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    {devEnvUpdating ? "Updating..." : devEnv.updateAvailable ? `Update available (${devEnv.latestCommit})` : "Check & update"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {devEnv?.configured && <Separator className="opacity-50" />}

        <div data-workspace-activity>
          <p className="text-sm font-medium text-muted">Workspace activity</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Status</span>
              <span className="font-medium">{instance?.status || WorkspaceStatus.STOPPED}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Port</span>
              <span className="font-mono">{instance?.port || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Last heartbeat</span>
              <span>
                {instance?.lastHeartbeat
                  ? new Date(instance.lastHeartbeat).toLocaleTimeString()
                  : "Never"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
