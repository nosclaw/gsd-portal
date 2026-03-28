"use client";

import { Chip } from "@heroui/react";

const statusStyles: Record<
  string,
  { color: "default" | "success" | "warning" | "danger" | "accent"; variant: "primary" | "secondary" | "tertiary" | "soft" }
> = {
  APPROVED: { color: "success", variant: "soft" },
  PENDING: { color: "warning", variant: "soft" },
  REJECTED: { color: "danger", variant: "soft" },
  SUSPENDED: { color: "danger", variant: "secondary" },
  RUNNING: { color: "success", variant: "secondary" },
  STARTING: { color: "warning", variant: "secondary" },
  PREPARING: { color: "warning", variant: "soft" },
  INITIALIZING: { color: "warning", variant: "soft" },
  SPAWNING: { color: "warning", variant: "secondary" },
  STOPPED: { color: "default", variant: "soft" },
  ERROR: { color: "danger", variant: "soft" },
  REVOKED: { color: "danger", variant: "secondary" },
  SUCCESS: { color: "success", variant: "soft" },
  FAILURE: { color: "danger", variant: "soft" },
  Stable: { color: "accent", variant: "soft" },
  Healthy: { color: "success", variant: "soft" },
  Review: { color: "warning", variant: "soft" },
  Watching: { color: "warning", variant: "soft" },
  Ready: { color: "success", variant: "soft" },
  Idle: { color: "default", variant: "soft" },
  None: { color: "default", variant: "soft" },
  Clear: { color: "success", variant: "soft" }
};

export function StatusChip({ status }: { status: string }) {
  const style = statusStyles[status] ?? { color: "default", variant: "soft" };

  return (
    <Chip color={style.color} size="sm" variant={style.variant}>
      {status}
    </Chip>
  );
}
