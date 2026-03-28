"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, Button, Chip } from "@heroui/react";
import {
  Activity,
  BellDot,
  Blocks,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  PanelLeftDashed,
  Settings,
  ShieldCheck,
  User,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Overview", icon: LayoutDashboard, roles: ["ROOT_ADMIN", "TENANT_ADMIN", "MEMBER"] },
  { href: "/workspace", label: "Workspace", icon: PanelLeftDashed, roles: ["ROOT_ADMIN", "TENANT_ADMIN", "MEMBER"] },
  { href: "/admin/users", label: "Approvals", icon: UsersRound, roles: ["ROOT_ADMIN", "TENANT_ADMIN"] },
  { href: "/admin/workspaces", label: "Workspaces", icon: Blocks, roles: ["ROOT_ADMIN", "TENANT_ADMIN"] },
  { href: "/admin/audit", label: "Audit", icon: ShieldCheck, roles: ["ROOT_ADMIN", "TENANT_ADMIN"] },
  { href: "/admin/health", label: "Health", icon: Activity, roles: ["ROOT_ADMIN", "TENANT_ADMIN"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["ROOT_ADMIN", "TENANT_ADMIN"] },
  { href: "/settings", label: "My profile", icon: User, roles: ["ROOT_ADMIN", "TENANT_ADMIN", "MEMBER"] }
];

export { items as sidebarItems };

export function Sidebar({ collapsed: controlledCollapsed, onCollapsedChange }: {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
} = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [workspaceStatus, setWorkspaceStatus] = useState<string>("STOPPED");
  const [pendingCount, setPendingCount] = useState(0);
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // Hydrate collapsed state from localStorage
  useEffect(() => {
    if (controlledCollapsed === undefined) {
      const stored = localStorage.getItem("sidebar-collapsed");
      if (stored === "true") setInternalCollapsed(true);
    }
  }, [controlledCollapsed]);

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const toggleCollapsed = () => {
    const next = !collapsed;
    if (onCollapsedChange) {
      onCollapsedChange(next);
    } else {
      setInternalCollapsed(next);
    }
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  useEffect(() => {
    const fetchStatus = () => {
      fetch("/api/workspaces/status")
        .then((res) => res.json())
        .then((data) => {
          setWorkspaceStatus(data?.instance?.status || "STOPPED");
        })
        .catch(() => {});
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const isAdmin = user?.role === "ROOT_ADMIN" || user?.role === "TENANT_ADMIN";
    if (!isAdmin) return;

    const fetchPending = () => {
      fetch("/api/admin/users")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setPendingCount(data.filter((u: any) => u.status === "PENDING").length);
          }
        })
        .catch(() => {});
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [user?.role]);

  const filteredItems = items.filter((item) => !item.roles || item.roles.includes(user?.role));

  const isLaunching = ["STARTING", "PREPARING", "INITIALIZING", "SPAWNING"].includes(workspaceStatus);
  const statusLabel = workspaceStatus === "RUNNING" ? "Running" : isLaunching ? "Starting" : "Offline";
  const statusColor = workspaceStatus === "RUNNING" ? "bg-emerald-400/20 text-emerald-100" : isLaunching ? "bg-amber-400/20 text-amber-100" : "bg-white/18 text-white";

  return (
    <div className="surface flex h-full flex-col gap-6 p-5 transition-all duration-[250ms] ease-in-out">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/30">
          <BellDot className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-semibold tracking-wide">GSD Portal</p>
            <p className="text-xs text-muted">GSD command center</p>
          </div>
        )}
      </div>

      {/* Status card */}
      {!collapsed && (
        <div className="surface-soft bg-gradient-to-br from-sky-500 to-blue-600 p-4 text-white">
          <p className="text-xs uppercase tracking-[0.28em] text-white/70">Status</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="max-w-[120px] truncate text-lg font-semibold">
                {user?.tenantName || "GSD"}
              </p>
              <p className="text-sm text-white/70">{user?.role || "Member"}</p>
            </div>
            <Chip className={statusColor} size="sm" variant="soft">
              {statusLabel}
            </Chip>
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-2">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "text-muted hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/8 dark:hover:text-white"
              )}
              href={item.href as any}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.label === "Approvals" && pendingCount > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
              {collapsed && item.label === "Approvals" && pendingCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
              {/* Tooltip in collapsed mode */}
              {collapsed && (
                <span className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-white dark:text-slate-900">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button */}
      <Button
        isIconOnly
        className="mx-auto rounded-full text-muted hover:text-foreground"
        size="sm"
        variant="ghost"
        onPress={toggleCollapsed}
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </Button>

      {/* User profile */}
      <div className={cn("surface-soft flex items-center gap-3 p-3", collapsed && "justify-center p-2")}>
        <Avatar>
          <AvatarFallback>
            {(user?.name || "U").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name || "User"}</p>
              <p className="truncate text-xs text-muted">@{user?.username || "username"}</p>
            </div>
            <Button
              isIconOnly
              className="rounded-full text-muted hover:text-danger"
              size="sm"
              variant="ghost"
              onPress={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
