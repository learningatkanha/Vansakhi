"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SpeciesSearch } from "@/components/species-search";
import { Button } from "@/components/ui";
import type { SpeciesMatch } from "@/lib/gbif";
import { SureChoice } from "@/components/sure-choice";
import { nameSighting, type NameState } from "../add/actions";

type Sighting = { id: string; title: string; dateLabel: string; place: string | null; named: boolean };

/** Look up a species, then use it: name one of your sightings, or record a new one. */
export function ExploreSpecies({ sightings, reviewer = false }: { sightings: Sighting[]; reviewer?: boolean }) {
  const [species, setSpecies] = useState<SpeciesMatch | null>(null);
  const [sure, setSure] = useState<boolean | null>(null);
  const [state, action, pending] = useActionState<NameState, FormData>(nameSighting, {});
  const name = species ? (species.commonName ?? species.scientificName) : "";

  return (
    <div>
      <SpeciesSearch value={species} onSelect={setSpecies} />
      {species && (
        <div className="mt-4 space-y-4 border-t border-line pt-4 text-sm">
          <Link
            href={`/add?species=${encodeURIComponent(JSON.stringify(species))}`}
            className="inline-flex h-9 items-center rounded-full bg-forest-600 px-4 font-medium text-white hover:bg-forest-700"
          >
            + Record a new sighting of {name}
          </Link>

          {sightings.length > 0 && (
            <form action={action} className="space-y-2">
              <input type="hidden" name="species" value={JSON.stringify(species)} />
              <label htmlFor="observationId" className="block font-medium">
                Or name one of your sightings as {name}
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="observationId"
                  name="observationId"
                  required
                  defaultValue=""
                  className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 text-sm"
                >
                  <option value="" disabled>
                    Choose a sighting…
                  </option>
                  {sightings.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.dateLabel} — {s.title}
                      {s.place ? ` · ${s.place}` : ""}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={pending || sure === null} className="h-9 shrink-0 px-4">
                  {pending ? "Saving…" : "Save"}
                </Button>
              </div>
              <p className="text-xs text-muted">Sightings without a name are listed first.</p>
              <SureChoice name="sure" value={sure} onChange={setSure} reviewer={reviewer} />
              {state.error && <p className="text-red-700">{state.error}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
