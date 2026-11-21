"use client";

import { useState } from "react";
import type { SpeciesMatch } from "@/lib/gbif";
import { Input } from "./ui";
import { useSearch } from "./use-search";

/** A small real photo of the species, or a leaf when none is found. */
function SpeciesThumb({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-wash text-lg">
        🌿
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/species/photo?name=${encodeURIComponent(name)}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-md bg-wash object-cover"
    />
  );
}

export function SpeciesSearch({
  value,
  onSelect,
  onQueryChange,
  id = "species",
  initialQuery = "",
}: {
  value?: SpeciesMatch | null;
  onSelect?: (s: SpeciesMatch | null) => void;
  onQueryChange?: (q: string) => void;
  id?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [inner, setInner] = useState<SpeciesMatch | null>(null);
  const selected = value !== undefined ? value : inner;
  const { results, loading, error } = useSearch<SpeciesMatch>("/api/species", selected ? "" : query);

  function choose(s: SpeciesMatch | null) {
    setInner(s);
    onSelect?.(s);
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-forest-600 bg-forest-50 px-3 py-2">
        <SpeciesThumb key={selected.scientificName} name={selected.scientificName} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{selected.commonName ?? selected.scientificName}</p>
          <p className="text-xs italic text-muted">{selected.scientificName}</p>
        </div>
        <button type="button" onClick={() => choose(null)} className="text-xs text-forest-700 hover:underline">
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <Input
        id={id}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onQueryChange?.(e.target.value);
        }}
        placeholder="Common or scientific name, e.g. barasingha"
        autoComplete="off"
      />
      {loading && <p className="mt-2 text-xs text-muted">Searching…</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
          {results.map((s) => (
            <li key={s.gbifKey}>
              <button type="button" onClick={() => choose(s)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-wash">
                <SpeciesThumb key={s.scientificName} name={s.scientificName} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{s.commonName ?? s.scientificName}</span>
                  <span className="block text-xs text-muted">
                    <i>{s.scientificName}</i>
                    {s.group ? ` · ${s.group}` : ""}
                    {s.hindiName ? ` · ${s.hindiName}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-2 text-xs text-muted">No species found. Try the scientific name.</p>
      )}
    </div>
  );
}
