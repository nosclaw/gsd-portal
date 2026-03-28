"use client";

import { useMemo, useState } from "react";

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
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultSort?.key ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSort?.dir ?? "asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(pageSize);

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
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(1);
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
    setPage,
    perPage,
    setPerPage: (n: number) => { setPerPage(n); setPage(1); },
    totalPages
  };
}
