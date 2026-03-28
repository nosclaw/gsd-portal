"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Hydrate collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  // Close mobile drawer on resize above md
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen px-4 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-6">
        {/* Desktop sidebar */}
        <aside
          className="hidden shrink-0 md:block transition-all duration-[250ms] ease-in-out"
          style={{ width: collapsed ? 64 : 280 }}
        >
          <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
        </aside>

        {/* Mobile drawer overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer */}
            <aside className="relative z-10 h-full w-[280px] animate-in slide-in-from-left duration-200">
              <Sidebar />
            </aside>
          </div>
        )}

        <div className="flex min-h-full min-w-0 flex-1 flex-col gap-6">
          <Topbar onMenuClick={() => setMobileOpen((v) => !v)} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
