"use client";

import { Button, Card, Input, Label } from "@/components/ui";
import { PlaceSearch } from "@/components/place-search";
import { SpeciesSearch } from "@/components/species-search";

/** Phase 1 preview of the add form: species and place search work; saving and uploads arrive in phase 2. */
export function AddForm() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card className="max-w-xl space-y-6">
      <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-line text-sm text-muted">
        Drop photos or a video here (phase 2)
      </div>
      <div>
        <Label htmlFor="species">Species</Label>
        <SpeciesSearch />
        <p className="mt-1.5 text-xs text-muted">Once a photo is added, AI suggestions will appear here (phase 5).</p>
      </div>
      <div>
        <Label htmlFor="place">Place</Label>
        <PlaceSearch />
      </div>
      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" defaultValue={today} max={today} />
      </div>
      <Button disabled className="w-full">
        Saving arrives in phase 2
      </Button>
    </Card>
  );
}
