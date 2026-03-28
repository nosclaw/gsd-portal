"use client";

import { Card, CardContent, CardHeader } from "@heroui/react";

import { sparklinePath } from "@/lib/utils";

export function ChartPanel({
  title,
  subtitle,
  values,
  stroke = "#22c55e"
}: {
  title: string;
  subtitle: string;
  values: number[];
  stroke?: string;
}) {
  const path = sparklinePath(values, 460, 240, 16);
  const area = `${path} L 444 224 L 16 224 Z`;

  return (
    <Card className="surface h-full">
      <CardHeader className="flex items-start justify-between gap-3 px-6 pb-2 pt-6">
        <div>
          <p className="text-sm text-muted">{title}</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight">{subtitle}</h3>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-2">
        <div className="hero-grid surface-soft relative h-[260px] overflow-hidden p-4">
          <svg className="h-full w-full" viewBox="0 0 460 240" preserveAspectRatio="none">
            <defs>
              <linearGradient id="pulse-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#pulse-area)" />
            <path
              d={path}
              fill="none"
              stroke={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
