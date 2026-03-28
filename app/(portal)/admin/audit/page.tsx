"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@heroui/react";

import { AuditLogTable } from "@/components/admin/audit-log-table";
import { CardSkeleton } from "@/components/shared/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";

export default function AuditPage() {
  const [stats, setStats] = useState<{
    refreshFailures: number;
    userActions: number;
    criticalAlerts: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/audit")
      .then((res) => res.json())
      .then((raw) => {
        const data = Array.isArray(raw) ? raw : (raw.data ?? []);
        {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayLogs = data.filter((log: any) => {
            const ts = new Date(log.timestamp);
            return ts >= today;
          });

          setStats({
            refreshFailures: todayLogs.filter(
              (l: any) => l.action === "SESSION_REFRESH_FAILED"
            ).length,
            userActions: todayLogs.filter(
              (l: any) => l.actor !== "system"
            ).length,
            criticalAlerts: todayLogs.filter(
              (l: any) => l.result === "FAILURE"
            ).length
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleExportLogs = useCallback(() => {
    // Export audit logs as JSON download
    fetch("/api/admin/audit")
      .then((res) => res.json())
      .then((data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  }, []);

  const handleFilterScope = useCallback(() => {
    // Focus the audit table for filtering
    const table = document.querySelector("table");
    if (table) {
      table.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Inspect approval outcomes, workspace transitions and session renewal signals with actor-aware, resource-aware audit detail."
        eyebrow="Admin / audit"
        primaryAction="Export logs"
        secondaryAction="Filter scope"
        onPrimaryAction={handleExportLogs}
        onSecondaryAction={handleFilterScope}
        title="Audit trail"
      />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <AuditLogTable />
        <Card className="surface">
          <CardContent className="gap-4 p-5">
            <div>
              <p className="text-sm text-muted">Incident watch</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Today at a glance</h3>
            </div>
            {stats ? (
              <>
                <div className="surface-soft p-4">
                  <p className="text-sm text-muted">Refresh failures</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.refreshFailures}</p>
                </div>
                <div className="surface-soft p-4">
                  <p className="text-sm text-muted">User actions</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.userActions}</p>
                </div>
                <div className="surface-soft p-4">
                  <p className="text-sm text-muted">Critical alerts</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.criticalAlerts}</p>
                </div>
              </>
            ) : (
              <CardSkeleton lines={3} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
