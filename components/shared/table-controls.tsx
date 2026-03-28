"use client";

import { Button, Input, TextField } from "@heroui/react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export function TableSearch({
  value,
  onChange,
  placeholder = "Search..."
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <TextField>
        <Input
          className="surface-soft w-full rounded-xl border-none pl-9 text-sm shadow-none"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </TextField>
    </div>
  );
}

export function TablePagination({
  page,
  totalPages,
  totalFiltered,
  totalAll,
  perPage,
  onPageChange,
  onPerPageChange
}: {
  page: number;
  totalPages: number;
  totalFiltered: number;
  totalAll: number;
  perPage: number;
  onPageChange: (p: number) => void;
  onPerPageChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted">
        {totalFiltered === totalAll
          ? `${totalAll} total`
          : `${totalFiltered} of ${totalAll} shown`}
      </p>

      <div className="flex items-center gap-2">
        <select
          className="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <Button
            isIconOnly size="sm" variant="ghost" className="rounded-lg"
            isDisabled={page <= 1}
            onPress={() => onPageChange(1)}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            isIconOnly size="sm" variant="ghost" className="rounded-lg"
            isDisabled={page <= 1}
            onPress={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <span className="px-2 text-xs font-medium">
            {page} / {totalPages}
          </span>

          <Button
            isIconOnly size="sm" variant="ghost" className="rounded-lg"
            isDisabled={page >= totalPages}
            onPress={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            isIconOnly size="sm" variant="ghost" className="rounded-lg"
            isDisabled={page >= totalPages}
            onPress={() => onPageChange(totalPages)}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
  return dir === "asc"
    ? <ArrowUp className="ml-1 inline h-3 w-3" />
    : <ArrowDown className="ml-1 inline h-3 w-3" />;
}

export function SortableHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort
}: {
  label: string;
  sortKey: string;
  currentKey: string | null;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  return (
    <th
      className="cursor-pointer select-none px-4 py-4 font-medium transition-colors hover:text-foreground"
      onClick={() => onSort(sortKey)}
    >
      {label}
      <SortIcon active={currentKey === sortKey} dir={currentDir} />
    </th>
  );
}
