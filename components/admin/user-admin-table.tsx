"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader
} from "@heroui/react";
import { ExternalLink, Play, Power, Shield, ShieldOff, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";

import { StatusChip } from "@/components/shared/status-chip";
import { ConfirmModal } from "@/components/shared/confirm-modal";

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
      await fetch("/api/admin/users/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action })
      });
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteTarget.id })
      });
      setDeleteTarget(null);
      await fetchUsers();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRoleChange = async () => {
    if (!roleTarget) return;
    setRoleLoading(true);
    try {
      await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: roleTarget.id, role: roleTarget.newRole })
      });
      setRoleTarget(null);
      await fetchUsers();
    } finally {
      setRoleLoading(false);
    }
  };

  const handleWorkspaceAction = async (userId: number, action: "start" | "stop") => {
    setActionLoading(`${userId}-ws-${action}`);
    try {
      if (action === "stop") {
        await fetch("/api/admin/workspaces/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId })
        });
      } else {
        // Use internal launch endpoint with admin override
        await fetch("/api/admin/workspaces/launch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId })
        });
      }
      await fetchUsers();
    } finally {
      setActionLoading(null);
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

  return (
    <>
      <Card className="surface">
        <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
          <p className="text-sm text-muted">User queue</p>
          <h3 className="text-2xl font-semibold tracking-tight">Approvals & access</h3>
        </CardHeader>
        <CardContent className="px-3 pb-4 pt-0">
          <div className="overflow-hidden rounded-[22px] border border-black/6 dark:border-white/8">
            <table className="w-full border-collapse text-left">
              <thead className="bg-black/3 dark:bg-white/4">
                <tr className="text-xs uppercase tracking-[0.2em] text-muted">
                  <th className="px-4 py-4 font-medium">User</th>
                  <th className="px-4 py-4 font-medium">Role</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium">Joined</th>
                  <th className="px-4 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6">
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
                    <td colSpan={5} className="py-8 text-center text-muted">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((row) => (
                    <tr key={row.id} className="border-t border-black/6 dark:border-white/8">
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
