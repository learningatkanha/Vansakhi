"use client";

import { useActionState, useState } from "react";
import { SpeciesSearch } from "@/components/species-search";
import { Button } from "@/components/ui";
import type { SpeciesMatch } from "@/lib/gbif";
import type { IdStatus } from "@/lib/id-status";
import { reviewSighting, type ReviewState } from "./actions";

/** Researchers and admins: Verify, Name & verify, or Undo verification, on anyone's sighting. */
export function ReviewBox({ id, status, named }: { id: string; status: IdStatus; named: boolean }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewSighting, {});
  const [naming, setNaming] = useState(false);
  const [species, setSpecies] = useState<SpeciesMatch | null>(null);

  return (
    <section className="rounded-xl border border-forest-600 bg-forest-50 p-4 text-sm">
      <h2 className="font-medium">Researcher review</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {named && status !== "verified" && (
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value="verify" />
            <Button type="submit" disabled={pending} className="h-9 px-4">
              ✓ Verify this name
            </Button>
          </form>
        )}
        <button
          type="button"
          onClick={() => setNaming((n) => !n)}
          className="h-9 rounded-full border border-forest-600 bg-paper px-4 font-medium text-forest-800 hover:bg-wash"
        >
          {named ? "Correct the name & verify" : "Name & verify"}
        </button>
        {status === "verified" && (
          <form
            action={action}
            onSubmit={(e) => {
              if (!confirm("Undo the verification? It goes back to Named and shows up for review again.")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value="undo" />
            <button type="submit" disabled={pending} className="text-sm text-muted hover:text-red-700 hover:underline">
              Undo verification
            </button>
          </form>
        )}
      </div>

      {naming && (
        <form action={action} className="mt-3 space-y-2 border-t border-forest-600/30 pt-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value="name" />
          <input type="hidden" name="species" value={species ? JSON.stringify(species) : ""} />
          <SpeciesSearch id="review-species" value={species} onSelect={setSpecies} />
          <Button type="submit" disabled={pending || !species} className="h-9 px-4">
            {pending ? "Saving…" : "Save name as Verified"}
          </Button>
        </form>
      )}
      {state.error && <p className="mt-2 text-red-700">{state.error}</p>}
      {pending && <p className="mt-2 text-muted">Saving…</p>}
    </section>
  );
}
