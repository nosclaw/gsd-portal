"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader
} from "@heroui/react";
import { Download, ExternalLink, Key, Play, Power, Shield, ShieldOff, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { StatusChip } from "@/components/shared/status-chip";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { TableSearch, TablePagination, SortableHeader } from "@/components/shared/table-controls";
import { useTable } from "@/lib/use-table";
import { exportToCsv } from "@/lib/csv-export";

export function UserAdminTable() {
  const { data: session } = useSession();
  const currentUser = session?.user as any;
  const [users, setUsers] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<number, string>>({}); // userId → status
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; username: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Role change modal state
  const [roleTarget, setRoleTarget] = useState<{ id: number; name: string; username: string; currentRole: string; newRole: string } | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchUsers = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const [usersRes, wsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/workspaces")
      ]);
      const usersData = await usersRes.json();
      const wsData = await wsRes.json();
      if (Array.isArray(usersData)) setUsers(usersData);
      if (Array.isArray(wsData)) {
        const map: Record<number, string> = {};
        wsData.forEach((ws: any) => { map[ws.userId] = ws.status; });
        setWorkspaces(map);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  const handleAction = async (userId: number, action: string) => {
    setActionLoading(`${userId}-${action}`);
    try {
      const res = await fetch("/api/admin/users/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`User ${action}d successfully`);
      } else {
        toast.error(data.error?.message || `Failed to ${action} user`);
      }
      await fetchUsers();
    } catch {
      toast.error(`Network error while trying to ${action} user`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteTarget.id })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`User @${deleteTarget.username} deleted`);
      } else {
        toast.error(data.error?.message || "Failed to delete user");
      }
      setDeleteTarget(null);
      await fetchUsers();
    } catch {
      toast.error("Network error while deleting user");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRoleChange = async () => {
    if (!roleTarget) return;
    setRoleLoading(true);
    try {
      const res = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: roleTarget.id, role: roleTarget.newRole })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`@${roleTarget.username} role changed to ${roleTarget.newRole}`);
      } else {
        toast.error(data.error?.message || "Failed to change role");
      }
      setRoleTarget(null);
      await fetchUsers();
    } catch {
      toast.error("Network error while changing role");
    } finally {
      setRoleLoading(false);
    }
  };

  const handleWorkspaceAction = async (userId: number, action: "start" | "stop") => {
    setActionLoading(`${userId}-ws-${action}`);
    try {
      const endpoint = action === "stop" ? "/api/admin/workspaces/stop" : "/api/admin/workspaces/launch";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Workspace ${action === "stop" ? "stopped" : "started"} successfully`);
      } else {
        toast.error(data.error?.message || `Failed to ${action} workspace`);
      }
      await fetchUsers();
    } catch {
      toast.error(`Network error while trying to ${action} workspace`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (userId: number, username: string) => {
    setActionLoading(`${userId}-reset`);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      if (res.ok && data.resetUrl) {
        const fullUrl = `${window.location.origin}${data.resetUrl}`;
        await navigator.clipboard.writeText(fullUrl);
        toast.success(`Reset link copied to clipboard for @${username}`);
      } else {
        toast.error(data.error?.message || "Failed to generate reset link");
      }
    } catch {
      toast.error("Network error while generating reset link");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulk = async (action: "approve" | "reject" | "suspend") => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedIds), action })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Bulk ${action}: ${data.processed} user(s) processed`);
      } else {
        toast.error(data.error || `Bulk ${action} failed`);
      }
      setSelectedIds(new Set());
      await fetchUsers();
    } catch {
      toast.error(`Network error during bulk ${action}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectableIds = table.rows
      .filter((r: any) => !isSelf(r.id) && r.role !== "ROOT_ADMIN")
      .map((r: any) => r.id);
    const allSelected = selectableIds.every((id: number) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  };

  useEffect(() => {
    fetchUsers(true);
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  }, []);

  const isSelf = (userId: number) => currentUser?.id && Number(currentUser.id) === userId;
  const isRootAdmin = (role: string) => role === "ROOT_ADMIN";
  const isCurrentRootAdmin = currentUser?.role === "ROOT_ADMIN";

  const table = useTable({
    data: users,
    defaultSort: { key: "name", dir: "asc" },
    pageSize: 10,
    searchKeys: ["name", "username", "email", "role", "status"]
  });

  return (
    <>
      <Card className="surface">
        <CardHeader className="flex flex-col gap-4 px-6 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted">User queue</p>
              <h3 className="text-2xl font-semibold tracking-tight">Approvals & access</h3>
            </div>
            <div className="flex items-center gap-2">
              <TableSearch
                value={table.search}
                onChange={table.setSearch}
                placeholder="Search users..."
              />
              <Button
                isIconOnly
                className="rounded-full"
                size="sm"
                variant="ghost"
                aria-label="Export CSV"
                onPress={() =>
                  exportToCsv(
                    users,
                    [
                      { key: "name", label: "Name" },
                      { key: "username", label: "Username" },
                      { key: "email", label: "Email" },
                      { key: "role", label: "Role" },
                      { key: "status", label: "Status" },
                      { key: "joinedAt", label: "Joined" }
                    ],
                    "users.csv"
                  )
                }
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-2xl bg-black/3 px-4 py-2 dark:bg-white/5">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button
                className="rounded-full"
                size="sm"
                variant="primary"
                isDisabled={bulkLoading}
                onPress={() => handleBulk("approve")}
              >
                Approve
              </Button>
              <Button
                className="rounded-full"
                size="sm"
                variant="danger-soft"
                isDisabled={bulkLoading}
                onPress={() => handleBulk("suspend")}
              >
                Suspend
              </Button>
              <Button
                className="rounded-full"
                size="sm"
                variant="ghost"
                onPress={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3 px-3 pb-4 pt-0">
          <div className="overflow-hidden rounded-[22px] border border-black/6 dark:border-white/8">
            <table className="w-full border-collapse text-left">
              <thead className="bg-black/3 dark:bg-white/4">
                <tr className="text-xs uppercase tracking-[0.2em] text-muted">
                  <th className="w-10 px-4 py-4">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={table.rows.length > 0 && table.rows
                        .filter((r: any) => !isSelf(r.id) && r.role !== "ROOT_ADMIN")
                        .every((r: any) => selectedIds.has(r.id))}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <SortableHeader label="User" sortKey="name" currentKey={table.sortKey as string} currentDir={table.sortDir} onSort={table.toggleSort} />
                  <SortableHeader label="Role" sortKey="role" currentKey={table.sortKey as string} currentDir={table.sortDir} onSort={table.toggleSort} />
                  <SortableHeader label="Status" sortKey="status" currentKey={table.sortKey as string} currentDir={table.sortDir} onSort={table.toggleSort} />
                  <SortableHeader label="Joined" sortKey="joinedAt" currentKey={table.sortKey as string} currentDir={table.sortDir} onSort={table.toggleSort} />
                  <th className="px-4 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6">
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-4">
                            <div className="h-8 w-24 animate-pulse rounded-xl bg-black/4 dark:bg-white/5" />
                            <div className="h-8 w-20 animate-pulse rounded-xl bg-black/4 dark:bg-white/5" />
                            <div className="h-8 w-16 animate-pulse rounded-xl bg-black/4 dark:bg-white/5" />
                            <div className="h-8 flex-1 animate-pulse rounded-xl bg-black/3 dark:bg-white/4" />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  table.rows.map((row) => (
                    <tr key={row.id} className="border-t border-black/6 dark:border-white/8">
                      <td className="w-10 px-4 py-4">
                        {!isSelf(row.id) && row.role !== "ROOT_ADMIN" && (
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelect(row.id)}
                          />
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium">
                              {row.name}
                              {isSelf(row.id) && <span className="ml-1 text-xs text-muted">(you)</span>}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-muted">@{row.username}</p>
                              {workspaces[row.id] === "RUNNING" && (
                                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                              )}
                            </div>
                          </div>
                          {workspaces[row.id] === "RUNNING" && (
                            <Button
                              isIconOnly
                              className="ml-auto rounded-full text-muted hover:text-primary"
                              size="sm"
                              variant="ghost"
                              aria-label="Open workspace"
                              onPress={() => window.open(`/api/admin/workspaces/open?userId=${row.id}`, "_blank")}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span>{row.role}</span>
                        {isCurrentRootAdmin && !isSelf(row.id) && !isRootAdmin(row.role) && (
                          <Button
                            isIconOnly
                            className="rounded-full text-muted hover:text-primary"
                            size="sm"
                            variant="ghost"
                            aria-label={row.role === "TENANT_ADMIN" ? "Demote to Member" : "Promote to Admin"}
                            onPress={() => setRoleTarget({
                              id: row.id,
                              name: row.name,
                              username: row.username,
                              currentRole: row.role,
                              newRole: row.role === "TENANT_ADMIN" ? "MEMBER" : "TENANT_ADMIN"
                            })}
                          >
                            {row.role === "TENANT_ADMIN"
                              ? <ShieldOff className="h-3.5 w-3.5" />
                              : <Shield className="h-3.5 w-3.5" />
                            }
                          </Button>
                        )}
                      </div>
                    </td>
                      <td className="px-4 py-4">
                        <StatusChip status={row.status} />
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {new Date(row.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {row.status === "PENDING" && (
                            <>
                              <Button
                                className="rounded-full"
                                size="sm"
                                variant="primary"
                                isDisabled={actionLoading !== null}
                                onPress={() => handleAction(row.id, "approve")}
                              >
                                {actionLoading === `${row.id}-approve` ? "..." : "Approve"}
                              </Button>
                              <Button
                                className="rounded-full"
                                size="sm"
                                variant="danger-soft"
                                isDisabled={actionLoading !== null}
                                onPress={() => handleAction(row.id, "reject")}
                              >
                                {actionLoading === `${row.id}-reject` ? "..." : "Reject"}
                              </Button>
                            </>
                          )}
                          {row.status === "APPROVED" && !isSelf(row.id) && (
                            <Button
                              className="rounded-full"
                              size="sm"
                              variant="danger-soft"
                              isDisabled={actionLoading !== null}
                              onPress={() => handleAction(row.id, "suspend")}
                            >
                              {actionLoading === `${row.id}-suspend` ? "..." : "Suspend"}
                            </Button>
                          )}
                          {row.status === "SUSPENDED" && (
                            <Button
                              className="rounded-full"
                              size="sm"
                              variant="primary"
                              isDisabled={actionLoading !== null}
                              onPress={() => handleAction(row.id, "approve")}
                            >
                              {actionLoading === `${row.id}-approve` ? "..." : "Reactivate"}
                            </Button>
                          )}
                          {row.status === "REJECTED" && (
                            <Button
                              className="rounded-full"
                              size="sm"
                              variant="primary"
                              isDisabled={actionLoading !== null}
                              onPress={() => handleAction(row.id, "approve")}
                            >
                              {actionLoading === `${row.id}-approve` ? "..." : "Approve"}
                            </Button>
                          )}

                          {/* Workspace start/stop — for approved users */}
                          {row.status === "APPROVED" && !isSelf(row.id) && (
                            workspaces[row.id] === "RUNNING" ? (
                              <Button
                                isIconOnly
                                className="rounded-full text-muted hover:text-danger"
                                size="sm"
                                variant="ghost"
                                aria-label="Stop workspace"
                                isDisabled={actionLoading !== null}
                                onPress={() => handleWorkspaceAction(row.id, "stop")}
                              >
                                {actionLoading === `${row.id}-ws-stop` ? <span className="text-xs">...</span> : <Power className="h-3.5 w-3.5" />}
                              </Button>
                            ) : (
                              <Button
                                isIconOnly
                                className="rounded-full text-muted hover:text-emerald-600"
                                size="sm"
                                variant="ghost"
                                aria-label="Start workspace"
                                isDisabled={actionLoading !== null}
                                onPress={() => handleWorkspaceAction(row.id, "start")}
                              >
                                {actionLoading === `${row.id}-ws-start` ? <span className="text-xs">...</span> : <Play className="h-3.5 w-3.5" />}
                              </Button>
                            )
                          )}

                          {/* Reset password — not for self or ROOT_ADMIN */}
                          {!isSelf(row.id) && !isRootAdmin(row.role) && (
                            <Button
                              isIconOnly
                              className="rounded-full text-muted hover:text-sky-500"
                              size="sm"
                              variant="ghost"
                              aria-label="Reset password"
                              isDisabled={actionLoading !== null}
                              onPress={() => handleResetPassword(row.id, row.username)}
                            >
                              {actionLoading === `${row.id}-reset` ? <span className="text-xs">...</span> : <Key className="h-3.5 w-3.5" />}
                            </Button>
                          )}

                          {/* Delete button — not for self or ROOT_ADMIN */}
                          {!isSelf(row.id) && !isRootAdmin(row.role) && (
                            <Button
                              isIconOnly
                              className="ml-1 rounded-full text-muted hover:text-danger"
                              size="sm"
                              variant="ghost"
                              onPress={() => setDeleteTarget({ id: row.id, name: row.name, username: row.username })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {isSelf(row.id) && row.status === "APPROVED" && (
                            <span className="text-xs text-muted">Cannot modify own account</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={table.page}
            totalPages={table.totalPages}
            totalFiltered={table.totalFiltered}
            totalAll={table.totalAll}
            perPage={table.perPage}
            onPageChange={table.setPage}
            onPerPageChange={table.setPerPage}
          />
        </CardContent>
      </Card>

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.name}?`}
        description={`This will permanently delete user @${deleteTarget?.username}, stop their workspace, and remove all their data including workspace files. This action cannot be undone.`}
        confirmText="Delete user"
        confirmMatch={deleteTarget?.username}
        variant="danger"
        loading={deleteLoading}
      />

      {/* Role change confirmation modal */}
      <ConfirmModal
        open={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        onConfirm={handleRoleChange}
        title={roleTarget?.newRole === "TENANT_ADMIN"
          ? `Promote ${roleTarget?.name} to Admin?`
          : `Demote ${roleTarget?.name} to Member?`
        }
        description={roleTarget?.newRole === "TENANT_ADMIN"
          ? `@${roleTarget?.username} will be able to approve users, manage workspaces, view audit logs, and access admin settings.`
          : `@${roleTarget?.username} will lose admin access and only be able to use their own workspace.`
        }
        confirmText={roleTarget?.newRole === "TENANT_ADMIN" ? "Promote to Admin" : "Demote to Member"}
        variant={roleTarget?.newRole === "TENANT_ADMIN" ? "warning" : "danger"}
        loading={roleLoading}
      />
    </>
  );
}
