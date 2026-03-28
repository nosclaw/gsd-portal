"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@heroui/react";
import { StatusChip } from "@/components/shared/status-chip";
import { TableSearch, TablePagination, SortableHeader } from "@/components/shared/table-controls";
import { useTable } from "@/lib/use-table";

export function AuditLogTable() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setLogs(data); })
      .finally(() => setLoading(false));
  }, []);

  const table = useTable({
    data: logs,
    defaultSort: { key: "timestamp", dir: "desc" },
    pageSize: 10,
    searchKeys: ["action", "actor", "resource", "result"]
  });

  return (
    <Card className="surface">
      <CardHeader className="flex flex-col gap-4 px-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">Audit trail</p>
          <h3 className="text-2xl font-semibold tracking-tight">Security & ops events</h3>
        </div>
        <TableSearch
          value={table.search}
          onChange={table.setSearch}
          placeholder="Search logs..."
        />
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-4 pt-0">
        <div className="overflow-hidden rounded-[22px] border border-black/6 dark:border-white/8">
          <table className="w-full border-collapse text-left">
            <thead className="bg-black/3 dark:bg-white/4">
              <tr className="text-xs uppercase tracking-[0.2em] text-muted">
                <SortableHeader label="Action" sortKey="action" currentKey={table.sortKey as string} currentDir={table.sortDir} onSort={table.toggleSort} />
                <SortableHeader label="Actor" sortKey="actor" currentKey={table.sortKey as string} currentDir={table.sortDir} onSort={table.toggleSort} />
                <SortableHeader label="Resource" sortKey="resource" currentKey={table.sortKey as string} currentDir={table.sortDir} onSort={table.toggleSort} />
                <SortableHeader label="Result" sortKey="result" currentKey={table.sortKey as string} currentDir={table.sortDir} onSort={table.toggleSort} />
                <SortableHeader label="Time" sortKey="timestamp" currentKey={table.sortKey as string} currentDir={table.sortDir} onSort={table.toggleSort} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6">
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-4">
                          <div className="h-8 w-28 animate-pulse rounded-xl bg-black/4 dark:bg-white/5" />
                          <div className="h-8 w-16 animate-pulse rounded-xl bg-black/4 dark:bg-white/5" />
                          <div className="h-8 w-32 animate-pulse rounded-xl bg-black/4 dark:bg-white/5" />
                          <div className="h-8 flex-1 animate-pulse rounded-xl bg-black/3 dark:bg-white/4" />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : table.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    {table.search ? "No matching logs." : "No logs found."}
                  </td>
                </tr>
              ) : (
                table.rows.map((row: any, i: number) => (
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
  );
}
