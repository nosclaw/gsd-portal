"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader
} from "@heroui/react";

import { CardSkeleton } from "@/components/shared/page-skeleton";
import { StatusChip } from "@/components/shared/status-chip";

type PortfolioRow = {
  name: string;
  symbol: string;
  status: string;
  count: number;
};

export function PortfolioTable() {
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((data) => setRows(data.portfolioRows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="surface h-full border-none p-6">
        <CardSkeleton lines={5} />
      </Card>
    );
  }

  return (
    <Card className="surface h-full border-none">
      <CardHeader className="flex flex-col items-start gap-1 px-6 pb-2 pt-6">
        <p className="text-sm text-muted">Tenant portfolio</p>
        <h3 className="text-2xl font-semibold tracking-tight">Runtime allocation</h3>
      </CardHeader>
      <CardContent className="px-3 pb-4 pt-0">
        <div className="overflow-hidden rounded-[22px] border border-black/6 dark:border-white/8">
          <table className="w-full border-collapse text-left">
            <thead className="bg-black/3 dark:bg-white/4">
              <tr className="text-xs uppercase tracking-[0.2em] text-muted">
                <th className="px-4 py-4 font-medium">Service</th>
                <th className="px-4 py-4 font-medium">Count</th>
                <th className="px-4 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.symbol} className="border-t border-black/6 dark:border-white/8">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
                        {row.symbol}
                      </div>
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted">{row.symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono">{row.count}</td>
                  <td className="px-4 py-4">
                    <StatusChip status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
