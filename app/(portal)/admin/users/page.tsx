"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@heroui/react";

import { UserAdminTable } from "@/components/admin/user-admin-table";
import { CardSkeleton } from "@/components/shared/page-skeleton";
import { PageHeader } from "@/components/shared/page-header";

export default function AdminUsersPage() {
  const [stats, setStats] = useState<{
    pendingCount: number;
    suspendedCount: number;
    totalCount: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setStats({
            pendingCount: data.filter((u: any) => u.status === "PENDING").length,
            suspendedCount: data.filter((u: any) => u.status === "SUSPENDED").length,
            totalCount: data.length
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleReviewPending = useCallback(() => {
    // Scroll to the user table and highlight pending
    const table = document.querySelector("table");
    if (table) {
      table.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const handleCreateInvite = useCallback(() => {
    // Navigate to registration page in a new tab so admin can share the link
    window.open("/auth/register", "_blank");
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review tenant onboarding, approve pending members and suspend access without leaving the same operator shell."
        eyebrow="Admin / users"
        primaryAction="Review pending"
        secondaryAction="Create invite"
        onPrimaryAction={handleReviewPending}
        onSecondaryAction={handleCreateInvite}
        title="Tenant approvals"
      />
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <UserAdminTable />
        <Card className="surface">
          <CardContent className="gap-4 p-5">
            <div>
              <p className="text-sm text-muted">Approval posture</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Queue health</h3>
            </div>
            {stats ? (
              <>
                <div className="surface-soft p-4">
                  <p className="text-sm text-muted">Pending members</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.pendingCount}</p>
                </div>
                <div className="surface-soft p-4">
                  <p className="text-sm text-muted">Suspended members</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.suspendedCount}</p>
                </div>
                <div className="surface-soft p-4">
                  <p className="text-sm text-muted">Total members</p>
                  <p className="mt-2 text-3xl font-semibold">{stats.totalCount}</p>
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
