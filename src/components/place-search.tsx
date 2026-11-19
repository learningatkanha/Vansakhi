"use client";

import { useState } from "react";
import type { PlaceMatch } from "@/lib/places";
import { Input } from "./ui";
import { useSearch } from "./use-search";

export function PlaceSearch({ onSelect, id = "place" }: { onSelect?: (p: PlaceMatch | null) => void; id?: string }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlaceMatch | null>(null);
  const { results, loading, error } = useSearch<PlaceMatch>("/api/places", selected ? "" : query, 500);

  function choose(p: PlaceMatch | null) {
    setSelected(p);
    onSelect?.(p);
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-forest-600 bg-forest-50 px-3 py-2">
        <div>
          <p className="text-sm font-medium">{selected.name}</p>
          <p className="text-xs text-muted">
            {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
          </p>
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
        placeholder="Village, town or landmark, e.g. Mocha, Mandla"
        autoComplete="off"
      />
      {loading && <p className="mt-2 text-xs text-muted">Looking up…</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
          {results.map((p) => (
            <li key={`${p.lat},${p.lng}`}>
              <button type="button" onClick={() => choose(p)} className="w-full px-3 py-2 text-left text-sm hover:bg-wash">
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
