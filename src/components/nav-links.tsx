"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/journal", label: "Journal" },
  { href: "/stats", label: "Stats" },
];

/** `reviewWaiting` is set (a number) only for researchers and admins: it adds the Review link. */
export function NavLinks({ reviewWaiting = null }: { reviewWaiting?: number | null }) {
  const pathname = usePathname();
  const links = reviewWaiting === null ? LINKS : [...LINKS, { href: "/review", label: "Review" }];
  return (
    <nav className="flex h-full items-stretch gap-1 sm:gap-4">
      {links.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center border-b-[3px] px-1.5 text-sm transition-colors ${
              active ? "border-forest-600 font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
            {href === "/review" && reviewWaiting ? (
              <span className="ml-1 rounded-full bg-meadow-50 px-1.5 text-xs font-semibold text-meadow-800">{reviewWaiting}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
