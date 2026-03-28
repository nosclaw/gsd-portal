"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Blocks,
  LayoutDashboard,
  PanelLeftDashed,
  Search,
  Settings,
  ShieldCheck,
  User,
  UsersRound
} from "lucide-react";
import { useRouter } from "next/navigation";

const pages = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Workspace", href: "/workspace", icon: PanelLeftDashed },
  { label: "Approvals", href: "/admin/users", icon: UsersRound },
  { label: "Workspaces", href: "/admin/workspaces", icon: Blocks },
  { label: "Audit", href: "/admin/audit", icon: ShieldCheck },
  { label: "Settings", href: "/admin/settings", icon: Settings },
  { label: "My Profile", href: "/settings", icon: User },
  { label: "Health", href: "/admin/health", icon: Activity }
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return pages;
    const q = query.toLowerCase();
    return pages.filter((p) => p.label.toLowerCase().includes(q));
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const select = useCallback((href: string) => {
    close();
    router.push(href as any);
  }, [close, router]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[activeIndex]) {
          select(filtered[activeIndex].href);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, activeIndex, close, select]);

  // Reset active index when filtered changes
  useEffect(() => { setActiveIndex(0); }, [filtered]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!mounted || !open) return null;

  const palette = (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={close}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg mx-4 animate-in zoom-in-95 fade-in duration-150">
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-black/5 px-4 dark:border-white/10">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              ref={inputRef}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted"
              placeholder="Search pages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd className="hidden shrink-0 rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] font-medium text-muted sm:inline-block dark:border-white/10">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-72 overflow-y-auto p-2">
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted">No results found</p>
            )}
            {filtered.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    i === activeIndex
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                      : "text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  onClick={() => select(item.href)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 border-t border-black/5 px-4 py-2 text-[11px] text-muted dark:border-white/10">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> select</span>
            <span><kbd className="font-mono">esc</kbd> close</span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(palette, document.body);
}
