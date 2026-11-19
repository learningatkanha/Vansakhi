"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/journal", label: "Journal" },
  { href: "/stats", label: "Stats" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex h-full items-stretch gap-1 sm:gap-4">
      {LINKS.map(({ href, label }) => {
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
          </Link>
        );
      })}
    </nav>
  );
}
