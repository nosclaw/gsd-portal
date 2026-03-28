"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Card, CardContent, CardHeader } from "@heroui/react";
import { Download } from "lucide-react";
import { StatusChip } from "@/components/shared/status-chip";
import { TableSearch, TablePagination, SortableHeader } from "@/components/shared/table-controls";
import { useTable } from "@/lib/use-table";
import { exportToCsv } from "@/lib/csv-export";

export function AuditLogTable() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const qs = params.toString();
    fetch(`/api/admin/audit${qs ? `?${qs}` : ""}`)
      .then((res) => res.json())
      .then((raw) => { const data = Array.isArray(raw) ? raw : (raw.data ?? []); setLogs(data); })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const table = useTable({
    data: logs,
    defaultSort: { key: "timestamp", dir: "desc" },
    pageSize: 10,
    searchKeys: ["action", "actor", "resource", "result"]
  });

  return (
    <Card className="surface">
      <CardHeader className="flex flex-col gap-4 px-6 pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted">Audit trail</p>
            <h3 className="text-2xl font-semibold tracking-tight">Security & ops events</h3>
          </div>
          <div className="flex items-center gap-2">
            <TableSearch
              value={table.search}
              onChange={table.setSearch}
              placeholder="Search logs..."
            />
            <Button
              isIconOnly
              className="rounded-full"
              size="sm"
              variant="ghost"
              aria-label="Export CSV"
              onPress={() =>
                exportToCsv(
                  logs,
                  [
                    { key: "action", label: "Action" },
                    { key: "actor", label: "Actor" },
                    { key: "resource", label: "Resource" },
                    { key: "result", label: "Result" },
                    { key: "timestamp", label: "Timestamp" }
                  ],
                  "audit-logs.csv"
                )
              }
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10"
          />
          <label className="text-xs text-muted">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10"
          />
          {(dateFrom || dateTo) && (
            <Button
              className="rounded-full"
              size="sm"
              variant="ghost"
              onPress={() => { setDateFrom(""); setDateTo(""); }}
            >
              Clear
            </Button>
          )}
        </div>
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
