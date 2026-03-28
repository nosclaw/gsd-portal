"use client";

import { Card, CardContent, Chip } from "@heroui/react";

import { sparklinePath } from "@/lib/utils";

const toneClasses: Record<string, string> = {
  emerald:
    "from-emerald-100 via-white to-emerald-50 dark:from-emerald-500/20 dark:via-white/5 dark:to-emerald-400/10",
  amber:
    "from-amber-100 via-white to-orange-50 dark:from-amber-500/20 dark:via-white/5 dark:to-orange-400/10",
  rose:
    "from-rose-100 via-white to-fuchsia-50 dark:from-rose-500/20 dark:via-white/5 dark:to-fuchsia-400/10"
};

const strokeClasses: Record<string, string> = {
  emerald: "#21c55d",
  amber: "#f59e0b",
  rose: "#f43f5e"
};

export function MetricCard({
  title,
  value,
  delta,
  tone,
  series
}: {
  title: string;
  value: string;
  delta: string;
  tone: string;
  series: number[];
}) {
  return (
    <Card className={`surface overflow-hidden bg-gradient-to-br ${toneClasses[tone] ?? toneClasses.emerald}`}>
      <CardContent className="gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{title}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">{value}</h3>
          </div>
          <Chip className="bg-black/5 dark:bg-white/10" size="sm" variant="soft">
            {delta}
          </Chip>
        </div>
        <svg className="h-20 w-full" viewBox="0 0 240 88" preserveAspectRatio="none">
          <path
            d={sparklinePath(series)}
            fill="none"
            stroke={strokeClasses[tone] ?? strokeClasses.emerald}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        </svg>
      </CardContent>
    </Card>
  );
}
