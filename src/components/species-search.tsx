"use client";

import { useState } from "react";
import type { SpeciesMatch } from "@/lib/gbif";
import { Input } from "./ui";
import { useSearch } from "./use-search";

export function SpeciesSearch({ onSelect, id = "species" }: { onSelect?: (s: SpeciesMatch | null) => void; id?: string }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SpeciesMatch | null>(null);
  const { results, loading, error } = useSearch<SpeciesMatch>("/api/species", selected ? "" : query);

  function choose(s: SpeciesMatch | null) {
    setSelected(s);
    onSelect?.(s);
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-forest-600 bg-forest-50 px-3 py-2">
        <div>
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
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Common or scientific name, e.g. barasingha"
        autoComplete="off"
      />
      {loading && <p className="mt-2 text-xs text-muted">Searching…</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
          {results.map((s) => (
            <li key={s.gbifKey}>
              <button type="button" onClick={() => choose(s)} className="w-full px-3 py-2 text-left hover:bg-wash">
                <span className="block text-sm font-medium">{s.commonName ?? s.scientificName}</span>
                <span className="block text-xs text-muted">
                  <i>{s.scientificName}</i>
                  {s.group ? ` · ${s.group}` : ""}
                  {s.hindiName ? ` · ${s.hindiName}` : ""}
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
