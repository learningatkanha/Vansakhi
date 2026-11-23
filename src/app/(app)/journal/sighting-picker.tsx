"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type PickerSighting = {
  id: string;
  title: string;
  when: string;
  place: string | null;
  thumb: string | null;
  status: string; // "Needs ID", "Named" or "Verified"
};

function Thumb({ src, size = "h-10 w-10" }: { src: string | null; size?: string }) {
  if (!src) {
    return (
      <span aria-hidden className={`flex ${size} shrink-0 items-center justify-center rounded-md bg-wash`}>
        🌿
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={`${size} shrink-0 rounded-md bg-wash object-cover`} />;
}

/** Search box whose drop-down shows sightings with their photos; choosing one shows its journal entries. */
export function SightingPicker({ sightings, selected, team }: { sightings: PickerSighting[]; selected: PickerSighting | null; team: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const base = team ? "/journal?show=team" : "/journal";
  const hrefFor = (id: string) => `${base}${team ? "&" : "?"}obs=${id}`;

  const q = query.trim().toLowerCase();
  const matches = sightings
    .filter((s) => !q || s.title.toLowerCase().includes(q) || (s.place ?? "").toLowerCase().includes(q) || s.status.toLowerCase().includes(q))
    .slice(0, 60);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-forest-600 bg-forest-50 p-2 pr-4">
        <Thumb src={selected.thumb} size="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Journal entries for</p>
          <p className="truncate font-medium">{selected.title}</p>
          <p className="truncate text-xs text-muted">
            {selected.when}
            {selected.place ? ` · ${selected.place}` : ""}
          </p>
        </div>
        <Link href={`/observations/${selected.id}`} className="hidden text-sm text-forest-700 hover:underline sm:inline">
          Open sighting
        </Link>
        <Link href={base} className="text-sm text-muted hover:text-ink" aria-label="Choose another sighting">
          ✕ Change
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={team ? "Choose one of the team's sightings…" : "Choose one of your sightings…"}
        aria-label="Choose a sighting"
        autoComplete="off"
        className="h-11 w-full rounded-xl border border-line bg-paper px-4 text-sm outline-none placeholder:text-muted focus:border-forest-600 focus:ring-2 focus:ring-forest-100"
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-96 w-full divide-y divide-line overflow-y-auto rounded-xl border border-line bg-paper shadow-lg">
          {matches.length === 0 && <li className="px-4 py-3 text-sm text-muted">No sightings match.</li>}
          {matches.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => router.push(hrefFor(s.id))}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-wash"
              >
                <Thumb src={s.thumb} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {s.when}
                    {s.place ? ` · ${s.place}` : ""}
                  </span>
                </span>
                {s.status === "Needs ID" && (
                  <span className="shrink-0 rounded-full border border-amber-500 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                    Needs ID
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
