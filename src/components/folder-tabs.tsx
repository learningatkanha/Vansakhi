import Link from "next/link";
import type { ReactNode } from "react";

/** Browser-style tabs whose selected tab joins the panel below (same look as the Home type tabs). */
export function FolderTabs({
  label,
  tabs,
  active,
  children,
}: {
  label: string;
  tabs: { key: string; label: string; count?: number; href: string }[];
  active: string;
  children: ReactNode;
}) {
  return (
    <div>
      <nav aria-label={label} className="relative z-10 -mx-4 flex gap-1 overflow-x-auto px-4 pt-1 sm:mx-0 sm:px-2">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`-mb-px shrink-0 whitespace-nowrap rounded-t-xl border px-4 py-2 text-sm transition-colors ${
                on ? "border-line border-b-paper bg-paper font-semibold text-ink" : "border-transparent bg-line/70 text-[#4d5649] hover:bg-line hover:text-ink"
              }`}
            >
              {t.label}
              {t.count !== undefined && <span className={`ml-1 text-xs ${on ? "text-forest-700" : "text-muted"}`}>{t.count}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="rounded-b-xl rounded-tr-xl border border-line bg-paper p-4 sm:p-5">{children}</div>
    </div>
  );
}
