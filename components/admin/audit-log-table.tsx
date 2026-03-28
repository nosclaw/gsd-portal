"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, Spinner } from "@heroui/react";
import { StatusChip } from "@/components/shared/status-chip";

export function AuditLogTable() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const res = await fetch("/api/admin/audit");
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
      setLoading(false);
    };
    fetchLogs();
  }, []);

  return (
    <Card className="surface">
      <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
        <p className="text-sm text-muted">Audit trail</p>
        <h3 className="text-2xl font-semibold tracking-tight">Security & ops events</h3>
      </CardHeader>
      <CardContent className="px-3 pb-4 pt-0">
        <div className="overflow-hidden rounded-[22px] border border-black/6 dark:border-white/8">
          <table className="w-full border-collapse text-left">
            <thead className="bg-black/3 dark:bg-white/4">
              <tr className="text-xs uppercase tracking-[0.2em] text-muted">
                <th className="px-4 py-4 font-medium">Action</th>
                <th className="px-4 py-4 font-medium">Actor</th>
                <th className="px-4 py-4 font-medium">Resource</th>
                <th className="px-4 py-4 font-medium">Result</th>
                <th className="px-4 py-4 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center">
                    <Spinner size="sm" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    No logs found.
                  </td>
                </tr>
              ) : (
                logs.map((row, i) => (
                  <tr key={i} className="border-t border-black/6 dark:border-white/8">
                    <td className="px-4 py-4 font-medium">{row.action}</td>
                    <td className="px-4 py-4">@{row.actor}</td>
                    <td className="px-4 py-4 font-mono text-xs text-muted">{row.resource}</td>
                    <td className="px-4 py-4">
                      <StatusChip status={row.result} />
                    </td>
                    <td className="px-4 py-4 text-xs text-muted">
                      {new Date(row.timestamp).toLocaleString()}
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
