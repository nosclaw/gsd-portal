"use client";

import { PageHeader } from "@/components/shared/page-header";
import { WorkspaceAdminTable } from "@/components/admin/workspace-admin-table";

export default function AdminWorkspacesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="View and manage all workspace instances across the tenant. Force-stop idle or stuck workspaces."
        eyebrow="Administration"
        title="Workspace management"
      />
      <WorkspaceAdminTable />
    </div>
  );
}
