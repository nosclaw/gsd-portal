import { AppShell } from "@/components/app-shell/app-shell";
import { CommandPalette } from "@/components/shared/command-palette";
import { SessionTimeoutGuard } from "@/components/session-timeout-guard";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <CommandPalette />
      <SessionTimeoutGuard />
    </AppShell>
  );
}
