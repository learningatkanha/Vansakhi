import Link from "next/link";
import { CATEGORIES, isCategory, type Category } from "@/lib/categories";

export const SHOWS = [
  { key: "all", label: "Everyone" },
  { key: "mine", label: "Mine" },
  { key: "needs-id", label: "Needs ID" },
] as const;
export type Show = (typeof SHOWS)[number]["key"];

/** Reads ?type= and ?show= from a page's search params. */
export function readFilters(params: Record<string, string | string[] | undefined>): { type: Category | "all"; show: Show } {
  const type = typeof params.type === "string" && isCategory(params.type) ? params.type : "all";
  const show = SHOWS.find((s) => s.key === params.show)?.key ?? "all";
  return { type, show };
}

/**
 * The type tabs (Mammals, Birds, …, with counts) and the Everyone / Mine / Needs ID row, which combine.
 * Used on Home and Explore, so both look and behave the same.
 */
export function SightingFilters({
  basePath,
  type,
  show,
  counts,
}: {
  basePath: string;
  type: Category | "all";
  show: Show;
  counts: Record<Category | "all", number>;
}) {
  const href = (t: Category | "all", s: Show) => {
    const q = new URLSearchParams();
    if (t !== "all") q.set("type", t);
    if (s !== "all") q.set("show", s);
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const tabs = [{ key: "all" as const, label: "All" }, ...CATEGORIES];

  return (
    <div className="mb-6 space-y-3">
      <nav
        aria-label="Type of living thing"
        className="-mx-4 flex overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0"
      >
        {tabs.map((t) => {
          const n = counts[t.key];
          if (n === 0 && t.key !== "all" && t.key !== type) return null; // hide empty tabs to keep the bar short
          const on = type === t.key;
          return (
            <Link
              key={t.key}
              href={href(t.key, show)}
              aria-current={on ? "page" : undefined}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm transition-colors ${
                on ? "border-forest-600 font-semibold text-ink" : "border-transparent text-muted hover:border-line hover:text-ink"
              }`}
            >
              {t.label} <span className={`text-xs ${on ? "text-forest-700" : "text-muted"}`}>{n}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex gap-2 text-sm">
        {SHOWS.map((s) => (
          <Link
            key={s.key}
            href={href(type, s.key)}
            className={`rounded-full px-2.5 py-0.5 ${show === s.key ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
