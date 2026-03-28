"use client";

import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-6">
        <aside className="hidden w-[280px] shrink-0 xl:block">
          <Sidebar />
        </aside>
        <div className="flex min-h-full min-w-0 flex-1 flex-col gap-6">
          <Topbar />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
