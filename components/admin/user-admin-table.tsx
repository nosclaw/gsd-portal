"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Spinner
} from "@heroui/react";
import { useSession } from "next-auth/react";

import { StatusChip } from "@/components/shared/status-chip";

export function UserAdminTable() {
  const { data: session } = useSession();
  const currentUser = session?.user as any;
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  const handleAction = async (userId: number, action: string, userName: string) => {
    const actionLabels: Record<string, string> = {
      approve: "approve",
      reject: "reject",
      suspend: "suspend"
    };

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabels[action] || action} user "${userName}"?`
    );
    if (!confirmed) return;

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const isSelf = (userId: number) => currentUser?.id && Number(currentUser.id) === userId;

  return (
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
                  <td colSpan={5} className="py-8 text-center">
                    <Spinner size="sm" />
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
                      <div>
                        <p className="font-medium">
                          {row.name}
                          {isSelf(row.id) && <span className="ml-1 text-xs text-muted">(you)</span>}
                        </p>
                        <p className="text-xs text-muted">@{row.username}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">{row.role}</td>
                    <td className="px-4 py-4">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {new Date(row.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {row.status === "PENDING" && (
                          <>
                            <Button
                              className="rounded-full"
                              size="sm"
                              variant="primary"
                              isDisabled={actionLoading !== null}
                              onPress={() => handleAction(row.id, "approve", row.name)}
                            >
                              {actionLoading === `${row.id}-approve` ? "..." : "Approve"}
                            </Button>
                            <Button
                              className="rounded-full"
                              size="sm"
                              variant="danger-soft"
                              isDisabled={actionLoading !== null}
                              onPress={() => handleAction(row.id, "reject", row.name)}
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
                            onPress={() => handleAction(row.id, "suspend", row.name)}
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
                            onPress={() => handleAction(row.id, "approve", row.name)}
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
                            onPress={() => handleAction(row.id, "approve", row.name)}
                          >
                            {actionLoading === `${row.id}-approve` ? "..." : "Approve"}
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
  );
}
