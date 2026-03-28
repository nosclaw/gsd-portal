"use client";

import { useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { WorkspaceOverview } from "@/components/workspace/workspace-overview";

export default function WorkspacePage() {
  const handleReconnect = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces/reconnect", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // WorkspaceOverview polling will reflect the state
    }
  }, []);

  const handleOpenLogs = useCallback(() => {
    // Scroll to workspace activity section at the bottom of the overview
    const el = document.querySelector("[data-workspace-activity]");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Track a single user's runtime, token renewal window, environment readiness and reconnect path from one operational view."
        eyebrow="Workspace"
        primaryAction="Reconnect session"
        secondaryAction="Open logs"
        onPrimaryAction={handleReconnect}
        onSecondaryAction={handleOpenLogs}
        title="Workspace runtime"
      />
      <WorkspaceOverview />
    </div>
  );
}
