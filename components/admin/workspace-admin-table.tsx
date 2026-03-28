"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Button,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow
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

  const handleForceStop = async (userId: number) => {
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
      <div className="flex min-h-[300px] items-center justify-center">
        <Spinner />
      </div>
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
    <Table aria-label="Workspace instances">
      <TableHeader>
        <TableColumn isRowHeader>USER</TableColumn>
        <TableColumn>STATUS</TableColumn>
        <TableColumn>PORT</TableColumn>
        <TableColumn>PID</TableColumn>
        <TableColumn>LAST HEARTBEAT</TableColumn>
        <TableColumn>ACTIONS</TableColumn>
      </TableHeader>
      <TableBody>
        {workspaces.map((ws) => (
          <TableRow key={ws.id} id={ws.id.toString()}>
            <TableCell>
              <div>
                <p className="font-medium">{ws.name}</p>
                <p className="text-xs text-muted">@{ws.username}</p>
              </div>
            </TableCell>
            <TableCell>
              <StatusChip status={ws.status} />
            </TableCell>
            <TableCell>
              <span className="font-mono text-sm">{ws.port}</span>
            </TableCell>
            <TableCell>
              <span className="font-mono text-sm">{ws.pid ?? "-"}</span>
            </TableCell>
            <TableCell>
              <span className="text-sm">
                {ws.lastHeartbeat
                  ? new Date(ws.lastHeartbeat).toLocaleString()
                  : "-"}
              </span>
            </TableCell>
            <TableCell>
              {ws.status === "RUNNING" && (
                <Button
                  size="sm"
                  variant="danger-soft"
                  isDisabled={stoppingId === ws.userId}
                  onPress={() => handleForceStop(ws.userId)}
                >
                  <Power className="h-3 w-3" />
                  {stoppingId === ws.userId ? "Stopping..." : "Force stop"}
                </Button>
              )}
              {ws.status === "ERROR" && ws.error && (
                <span className="text-xs text-danger">{ws.error}</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
