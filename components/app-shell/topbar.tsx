"use client";

import { useRef, useState } from "react";
import { Avatar, AvatarFallback, Button, Input, TextField } from "@heroui/react";
import { Command, Menu, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { ThemeToggle } from "@/components/shared/theme-toggle";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) {
      searchRef.current?.focus();
      return;
    }
    // Navigate to the most relevant section based on query
    const lower = q.toLowerCase();
    if (lower.includes("user") || lower.includes("approv") || lower.includes("member")) {
      router.push("/admin/users");
    } else if (lower.includes("audit") || lower.includes("log") || lower.includes("event")) {
      router.push("/admin/audit");
    } else if (lower.includes("workspace") || lower.includes("gsd") || lower.includes("port")) {
      router.push("/workspace");
    } else {
      router.push("/admin/audit");
    }
    setSearchQuery("");
  };

  const handleLaunchGsd = async () => {
    try {
      await fetch("/api/workspaces/launch", { method: "POST", headers: { "Content-Type": "application/json" } });
    } catch {
      // ignore, still try to open
    }
    window.open("/api/workspaces/open", "_blank");
  };

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div className="surface flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex items-center gap-3">
        {/* Hamburger for mobile */}
        <Button
          isIconOnly
          className="rounded-full text-muted md:hidden"
          size="sm"
          variant="ghost"
          onPress={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">Dashboard / v3</p>
          <div className="flex items-center gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">
              Control layer
            </h2>
            <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-500">
              healthy
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:w-[260px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <TextField>
            <Input
              ref={searchRef}
              aria-label="Search portal"
              className="surface-soft w-full rounded-full border-none pl-10 shadow-none"
              placeholder="Search users, workspaces, logs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </TextField>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="surface-soft rounded-full border-none bg-white/60 dark:bg-white/6"
            variant="ghost"
            onPress={handleSearch}
          >
            <span className="inline-flex items-center gap-2">
              <Command className="h-4 w-4" />
              Search
            </span>
          </Button>
          <Button
            className="rounded-full bg-sky-500 font-semibold text-white shadow-lg shadow-sky-500/25"
            onPress={handleLaunchGsd}
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Launch GSD
            </span>
          </Button>
          <ThemeToggle />
          <Avatar className="h-11 w-11">
            <AvatarFallback color="accent">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
}
