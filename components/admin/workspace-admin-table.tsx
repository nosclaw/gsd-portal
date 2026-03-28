"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader
} from "@heroui/react";
import { Power } from "lucide-react";

import { StatusChip } from "@/components/shared/status-chip";

interface WorkspaceRow {
  id: number;
  userId: number;
  port: number;
  status: string;
  pid: number | null;
  lastHeartbeat: string | null;
  error: string | null;
  username: string;
  name: string;
  email: string;
}

export function WorkspaceAdminTable() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stoppingId, setStoppingId] = useState<number | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/workspaces");
      const data = await res.json();
      if (Array.isArray(data)) {
        setWorkspaces(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
    const interval = setInterval(fetchWorkspaces, 10000);
    return () => clearInterval(interval);
  }, [fetchWorkspaces]);

  const handleForceStop = async (userId: number, userName: string) => {
    const confirmed = window.confirm(`Force stop workspace for "${userName}"?`);
    if (!confirmed) return;

    setStoppingId(userId);
    try {
      await fetch("/api/admin/workspaces/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      await fetchWorkspaces();
    } finally {
      setStoppingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="surface p-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 animate-pulse rounded-2xl bg-black/4 dark:bg-white/5" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded-full bg-black/4 dark:bg-white/5" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-black/3 dark:bg-white/4" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="surface-soft flex min-h-[300px] flex-col items-center justify-center gap-3 p-8">
        <p className="text-lg font-medium">No workspace instances</p>
        <p className="text-sm text-muted">
          Workspace instances will appear here once members launch their environments.
        </p>
      </div>
    );
  }

  return (
    <Card className="surface">
      <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
        <p className="text-sm text-muted">All instances</p>
        <h3 className="text-2xl font-semibold tracking-tight">Workspace instances</h3>
      </CardHeader>
      <CardContent className="px-3 pb-4 pt-0">
        <div className="overflow-hidden rounded-[22px] border border-black/6 dark:border-white/8">
          <table className="w-full border-collapse text-left">
            <thead className="bg-black/3 dark:bg-white/4">
              <tr className="text-xs uppercase tracking-[0.2em] text-muted">
                <th className="px-4 py-4 font-medium">User</th>
                <th className="px-4 py-4 font-medium">Status</th>
                <th className="px-4 py-4 font-medium">Port</th>
                <th className="px-4 py-4 font-medium">PID</th>
                <th className="px-4 py-4 font-medium">Last heartbeat</th>
                <th className="px-4 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((ws) => (
                <tr key={ws.id} className="border-t border-black/6 dark:border-white/8">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium">{ws.name}</p>
                      <p className="text-xs text-muted">@{ws.username}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusChip status={ws.status} />
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono text-sm">{ws.port}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono text-sm">{ws.pid ?? "-"}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm">
                      {ws.lastHeartbeat
                        ? new Date(ws.lastHeartbeat).toLocaleString()
                        : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {ws.status === "RUNNING" && (
                      <Button
                        size="sm"
                        variant="danger-soft"
                        isDisabled={stoppingId === ws.userId}
                        onPress={() => handleForceStop(ws.userId, ws.name)}
                      >
                        <Power className="h-3 w-3" />
                        {stoppingId === ws.userId ? "Stopping..." : "Force stop"}
                      </Button>
                    )}
                    {ws.status === "ERROR" && ws.error && (
                      <span className="text-xs text-danger">{ws.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
