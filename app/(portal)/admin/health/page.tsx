"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@heroui/react";
import { Activity, AlertTriangle, HardDrive } from "lucide-react";

import { CardSkeleton } from "@/components/shared/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function AdminHealthPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/health");
      const json = await res.json();
      setData(json);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const diskPercent = data?.diskUsage?.total
    ? Math.round((data.diskUsage.used / data.diskUsage.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Real-time health metrics for workspaces and infrastructure."
        eyebrow="Administration"
        title="Health"
      />

      {loading ? (
        <Card className="surface p-6">
          <CardSkeleton lines={3} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="surface">
            <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-500">
                <Activity className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted">Active workspaces</p>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              <p className="text-4xl font-bold tracking-tight">{data?.activeWorkspaces ?? 0}</p>
              <p className="mt-1 text-xs text-muted">Currently running</p>
            </CardContent>
          </Card>

          <Card className="surface">
            <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                (data?.failedLaunches24h ?? 0) > 0
                  ? "bg-red-500/12 text-red-500"
                  : "bg-amber-500/12 text-amber-500"
              }`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted">Failed launches (24h)</p>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              <p className="text-4xl font-bold tracking-tight">{data?.failedLaunches24h ?? 0}</p>
              <p className="mt-1 text-xs text-muted">Errors in last 24 hours</p>
            </CardContent>
          </Card>

          <Card className="surface">
            <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-500">
                <HardDrive className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted">Disk usage</p>
            </CardHeader>
            <CardContent className="space-y-3 px-6 pb-6 pt-0">
              <p className="text-4xl font-bold tracking-tight">{diskPercent}%</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/8">
                <div
                  className={`h-full rounded-full transition-all ${
                    diskPercent > 90 ? "bg-red-500" : diskPercent > 70 ? "bg-amber-500" : "bg-sky-500"
                  }`}
                  style={{ width: `${diskPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted">
                {formatBytes(data?.diskUsage?.used ?? 0)} / {formatBytes(data?.diskUsage?.total ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
