import Link from "next/link";
import type { Member } from "@/lib/auth";
import { signOut } from "@/app/actions";
import { NavLinks } from "./nav-links";

function initials(member: Member) {
  const source = member.name || member.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function TopBar({ member, reviewWaiting = null }: { member: Member; reviewWaiting?: number | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-8">
        <Link href="/" className="hidden font-serif text-[1.4rem] font-semibold leading-none text-forest-700 sm:block">
          Vansakhi
        </Link>
        <NavLinks reviewWaiting={reviewWaiting} />
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/add"
            className="inline-flex h-9 items-center rounded-full bg-forest-600 px-4 text-sm font-semibold text-white hover:bg-forest-700"
          >
            + Add
          </Link>
          <details className="relative">
            <summary
              aria-label="Account menu"
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-line text-xs font-semibold text-muted hover:border-forest-600 [&::-webkit-details-marker]:hidden"
            >
              {initials(member)}
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-paper p-2 shadow-lg">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-muted">{member.email}</p>
              </div>
              <div className="my-1 border-t border-line" />
              <Link href="/account" className="block rounded-lg px-3 py-2 text-sm hover:bg-wash">
                Change password
              </Link>
              {member.role === "admin" && (
                <Link href="/admin" className="block rounded-lg px-3 py-2 text-sm hover:bg-wash">
                  Admin
                </Link>
              )}
              <form action={signOut}>
                <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-wash">
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
