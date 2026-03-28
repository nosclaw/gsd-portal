"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface UseTableOptions<T> {
  data: T[];
  defaultSort?: { key: keyof T; dir: "asc" | "desc" };
  pageSize?: number;
  searchKeys?: (keyof T)[];
}

export function useTable<T extends Record<string, any>>({
  data,
  defaultSort,
  pageSize = 10,
  searchKeys = []
}: UseTableOptions<T>) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize from URL params
  const urlPage = searchParams.get("page");
  const urlSort = searchParams.get("sort");
  const urlDir = searchParams.get("dir");
  const urlQ = searchParams.get("q");

  const [search, setSearchState] = useState(urlQ ?? "");
  const [sortKey, setSortKey] = useState<keyof T | null>(
    (urlSort as keyof T) ?? defaultSort?.key ?? null
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    (urlDir as "asc" | "desc") ?? defaultSort?.dir ?? "asc"
  );
  const [page, setPage] = useState(urlPage ? Number(urlPage) : 1);
  const [perPage, setPerPage] = useState(pageSize);

  // Sync state to URL
  const syncUrl = useCallback(
    (params: { page?: number; sort?: keyof T | null; dir?: string; q?: string }) => {
      const sp = new URLSearchParams(searchParams.toString());

      const p = params.page ?? page;
      const s = params.sort !== undefined ? params.sort : sortKey;
      const d = params.dir ?? sortDir;
      const q = params.q ?? search;

      if (p > 1) sp.set("page", String(p)); else sp.delete("page");
      if (s) sp.set("sort", String(s)); else sp.delete("sort");
      if (s && d) sp.set("dir", d); else sp.delete("dir");
      if (q.trim()) sp.set("q", q.trim()); else sp.delete("q");

      const qs = sp.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [searchParams, router, page, sortKey, sortDir, search]
  );

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((key) => {
        const val = row[key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchKeys]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const toggleSort = (key: keyof T | string) => {
    let newDir: "asc" | "desc";
    let newKey: keyof T;
    if (sortKey === key) {
      newDir = sortDir === "asc" ? "desc" : "asc";
      newKey = key as keyof T;
    } else {
      newKey = key as keyof T;
      newDir = "asc";
    }
    setSortKey(newKey);
    setSortDir(newDir);
    setPage(1);
    syncUrl({ sort: newKey, dir: newDir, page: 1 });
  };

  const handleSearch = (q: string) => {
    setSearchState(q);
    setPage(1);
    syncUrl({ q, page: 1 });
  };

  const handleSetPage = (p: number) => {
    setPage(p);
    syncUrl({ page: p });
  };

  return {
    // Data
    rows: paginated,
    totalFiltered: filtered.length,
    totalAll: data.length,
    // Search
    search,
    setSearch: handleSearch,
    // Sort
    sortKey,
    sortDir,
    toggleSort,
    // Pagination
    page: safePage,
    setPage: handleSetPage,
    perPage,
    setPerPage: (n: number) => { setPerPage(n); setPage(1); syncUrl({ page: 1 }); },
    totalPages
  };
}
