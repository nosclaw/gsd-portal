"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Spinner
} from "@heroui/react";

import { StatusChip } from "@/components/shared/status-chip";

export function UserAdminTable() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (Array.isArray(data)) {
      setUsers(data);
    }
    setLoading(false);
  };

  const handleAction = async (userId: number, action: string) => {
    await fetch("/api/admin/users/approve", {
      method: "POST",
      body: JSON.stringify({ userId, action })
    });
    fetchUsers();
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
                  <tr key={row.username} className="border-t border-black/6 dark:border-white/8">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted">@{row.username}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">{row.role}</td>
                    <td className="px-4 py-4">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="px-4 py-4">
                      {new Date(row.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {row.status === "PENDING" && (
                          <Button
                            className="rounded-full"
                            size="sm"
                            variant="primary"
                            onPress={() => handleAction(row.id, "approve")}
                          >
                            Approve
                          </Button>
                        )}
                        {row.status !== "SUSPENDED" && (
                          <Button
                            className="rounded-full"
                            size="sm"
                            variant="danger-soft"
                            onPress={() => handleAction(row.id, "suspend")}
                          >
                            Suspend
                          </Button>
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
