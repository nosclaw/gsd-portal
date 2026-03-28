"use client";

/**
 * Lightweight skeleton loader for page-level loading states.
 * Shows animated placeholder blocks instead of a large spinner.
 */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-24 rounded-full bg-black/5 dark:bg-white/5" />
        <div className="h-9 w-64 rounded-2xl bg-black/5 dark:bg-white/5" />
        <div className="h-4 w-96 rounded-full bg-black/4 dark:bg-white/4" />
      </div>

      {/* Content skeleton */}
      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface rounded-3xl p-5">
            <div className="space-y-3">
              <div className="h-3 w-20 animate-pulse rounded-full bg-black/5 dark:bg-white/6" />
              <div className="h-7 w-16 animate-pulse rounded-xl bg-black/5 dark:bg-white/6" />
            </div>
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="surface rounded-3xl p-5">
        <div className="space-y-4">
          <div className="h-4 w-32 animate-pulse rounded-full bg-black/5 dark:bg-white/6" />
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4"
              style={{ animationDelay: `${i * 75}ms` }}
            >
              <div className="h-10 w-10 animate-pulse rounded-2xl bg-black/4 dark:bg-white/5" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded-full bg-black/4 dark:bg-white/5" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-black/3 dark:bg-white/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Small inline skeleton for card-level loading.
 */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 p-1">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded-full bg-black/5 dark:bg-white/6" />
          <div className="h-7 w-16 animate-pulse rounded-xl bg-black/5 dark:bg-white/6" />
        </div>
      ))}
    </div>
  );
}
