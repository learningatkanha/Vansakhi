"use client";

import { useActionState, useState } from "react";
import { SpeciesSearch } from "@/components/species-search";
import { Button, Input } from "@/components/ui";
import type { SpeciesMatch } from "@/lib/gbif";
import { suggestName, type SuggestState } from "./actions";

/** "Suggest a name": on someone else's sighting, or on your own when you're not sure (Edit is for when you are). */
export function SuggestForm({ observationId, own = false }: { observationId: string; own?: boolean }) {
  const [species, setSpecies] = useState<SpeciesMatch | null>(null);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SuggestState, FormData>(async (prev, fd) => {
    const result = await suggestName(prev, fd);
    if (result.done) {
      setSpecies(null);
      setOpen(false);
    }
    return result;
  }, {});

  if (!open) {
    return (
      <div className="space-y-1">
        {state.done && <p className="text-xs text-forest-700">Thank you! Your suggestion has been added.</p>}
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-forest-700 hover:underline">
          + Suggest a name
        </button>
        {own && <p className="text-xs text-muted">Not sure? Your guess stays a suggestion until it&apos;s confirmed. If you&apos;re sure, use Edit.</p>}
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="observationId" value={observationId} />
      <input type="hidden" name="species" value={species ? JSON.stringify(species) : ""} />
      <SpeciesSearch id="suggest-species" value={species} onSelect={setSpecies} />
      <Input name="note" maxLength={300} placeholder="Why you think so (optional), e.g. white patch on the wing" />
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !species}>
          {pending ? "Saving…" : "Suggest this name"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
