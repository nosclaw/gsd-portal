"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, Spinner } from "@heroui/react";

import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";

interface DashboardStats {
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  activeWorkspaces: number;
  recentAuditCount: number;
  recentEvents: {
    actor: string;
    action: string;
    resource: string;
    result: string;
    timestamp: string;
  }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted">Failed to load dashboard data.</p>
      </div>
    );
  }

  const metrics = [
    {
      title: "Total members",
      value: stats.totalUsers.toString(),
      delta: `${stats.approvedUsers} approved`,
      tone: "emerald",
      series: [stats.totalUsers, stats.approvedUsers, stats.pendingUsers]
    },
    {
      title: "Pending approvals",
      value: stats.pendingUsers.toString(),
      delta: "awaiting review",
      tone: stats.pendingUsers > 0 ? "amber" : "emerald",
      series: [stats.pendingUsers]
    },
    {
      title: "Active workspaces",
      value: stats.activeWorkspaces.toString(),
      delta: "running now",
      tone: "emerald",
      series: [stats.activeWorkspaces]
    },
    {
      title: "Audit events (24h)",
      value: stats.recentAuditCount.toString(),
      delta: "last 24 hours",
      tone: "emerald",
      series: [stats.recentAuditCount]
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Real-time overview of platform health, member status, and workspace activity."
        eyebrow="Dashboard"
        title="GSD command center"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {metrics.map((card) => (
          <MetricCard key={card.title} {...card} series={[...card.series]} />
        ))}
      </div>

      <Card className="surface">
        <CardContent className="gap-3 p-5">
          <div>
            <p className="text-sm text-muted">Activity feed</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              Recent platform events
            </h3>
          </div>
          {stats.recentEvents.length === 0 ? (
            <div className="surface-soft flex items-center justify-center p-8">
              <p className="text-sm text-muted">No events recorded yet.</p>
            </div>
          ) : (
            stats.recentEvents.map((event, index) => (
              <div key={index} className="surface-soft flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{event.action.replace(/_/g, " ").toLowerCase()}</p>
                  <p className="text-sm text-muted">
                    {event.actor} &middot; {event.resource}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusChip status={event.result} />
                  <span className="whitespace-nowrap text-xs text-muted">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
