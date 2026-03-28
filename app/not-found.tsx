import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em]">
          404
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-5xl tracking-tight">
          Page not found
        </h1>
        <p className="text-base leading-8 text-slate-400">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="rounded-full bg-sky-500 px-6 py-3 font-semibold text-white shadow-lg shadow-sky-500/25 transition-colors hover:bg-sky-600"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
