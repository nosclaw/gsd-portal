"use client";

import { Button } from "@heroui/react";
import { ArrowUpRight, Plus } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  onPrimaryAction,
  onSecondaryAction
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: string;
  secondaryAction?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-muted">{eyebrow}</p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-muted sm:text-base">{description}</p>
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap gap-3">
          {secondaryAction ? (
            <Button className="rounded-full" variant="outline" onPress={onSecondaryAction}>
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {secondaryAction}
              </span>
            </Button>
          ) : null}
          {primaryAction ? (
            <Button
              className="rounded-full bg-sky-500 font-semibold text-white shadow-lg shadow-sky-500/25"
              onPress={onPrimaryAction}
            >
              <span className="inline-flex items-center gap-2">
                {primaryAction}
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
