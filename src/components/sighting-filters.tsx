import Link from "next/link";
import { CATEGORIES, isCategory, type Category } from "@/lib/categories";

export const SHOWS = [
  { key: "all", label: "Everyone" },
  { key: "mine", label: "Mine" },
  { key: "needs-id", label: "Needs ID" },
] as const;
export type Show = (typeof SHOWS)[number]["key"];

/** Reads ?type= and ?show= from a page's search params. */
export function readFilters(
  params: Record<string, string | string[] | undefined>,
): { type: Category | "all"; show: Show } {
  const type =
    typeof params.type === "string" && isCategory(params.type)
      ? params.type
      : "all";
  const show = SHOWS.find((s) => s.key === params.show)?.key ?? "all";
  return { type, show };
}

/**
 * Browser-style tabs for the type of living thing (Mammals, Birds, …, with counts). The selected tab joins the
 * panel below, which holds the Everyone / Mine / Needs ID row and the page's sightings (children).
 * Used on Home and Explore, so both look and behave the same.
 */
export function SightingFilters({
  basePath,
  type,
  show,
  counts,
  children,
}: {
  basePath: string;
  type: Category | "all";
  show: Show;
  counts: Record<Category | "all", number>;
  children: React.ReactNode;
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
    <div>
      <nav
        aria-label="Type of living thing"
        className="relative z-10 -mx-4 flex gap-1 overflow-x-auto px-4 pt-1 sm:mx-0 sm:px-2"
      >
        {tabs.map((t) => {
          const n = counts[t.key];
          if (n === 0 && t.key !== "all" && t.key !== type) return null; // hide empty tabs to keep the row short
          const on = type === t.key;
          return (
            <Link
              key={t.key}
              href={href(t.key, show)}
              aria-current={on ? "page" : undefined}
              className={`-mb-px shrink-0 whitespace-nowrap rounded-t-xl border px-4 py-2 text-sm transition-colors ${
                on
                  ? "border-line border-b-paper bg-paper font-semibold text-ink"
                  : "border-transparent bg-line/70 text-muted hover:bg-line hover:text-ink"
              }`}
            >
              {t.label}{" "}
              <span
                className={`text-xs ${on ? "text-forest-700" : "text-muted"}`}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="rounded-b-xl rounded-tr-xl border border-line bg-paper p-4 sm:p-5">
        <nav aria-label="Whose sightings" className="mb-5 flex gap-1 border-b border-line">
          {SHOWS.map((s) => {
            const on = show === s.key;
            return (
              <Link
                key={s.key}
                href={href(type, s.key)}
                aria-current={on ? "page" : undefined}
                className={`-mb-px rounded-t-lg border px-3.5 py-1.5 text-sm transition-colors ${
                  on
                    ? "border-line border-b-paper bg-paper font-semibold text-ink"
                    : "border-transparent bg-line/50 text-muted hover:bg-line hover:text-ink"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </div>
  );
}
