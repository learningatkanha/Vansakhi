"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { PlaceSearch } from "@/components/place-search";
import { SpeciesSearch } from "@/components/species-search";
import { SureChoice } from "@/components/sure-choice";
import { MediaUploader, type UploadItem } from "@/components/media-uploader";
import type { SpeciesMatch } from "@/lib/gbif";
import type { PlaceMatch } from "@/lib/places";
import { monthOf, timeOfDayOf, WEATHER_CHOICES } from "@/lib/when";
import { saveObservation, type ObservationInput, type SaveState } from "./actions";

/** "2026-11-14T07:42" in the browser's own time zone, for a datetime-local input. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DETAIL_FIELDS = [
  { name: "life_stage", label: "Life stage", placeholder: "adult, juvenile, flowering…" },
  { name: "sex", label: "Sex", placeholder: "male, female, unknown" },
  { name: "behaviour", label: "Behaviour", placeholder: "grazing, calling, crossing road…" },
  { name: "habitat", label: "Habitat", placeholder: "sal forest, meadow, stream bank…" },
  { name: "weather", label: "Weather", placeholder: "clear, misty, light rain…" },
] as const;

/** A saved sighting, for the edit page. */
export type ObservationInitial = {
  id: string;
  species: SpeciesMatch | null;
  speciesGuess: string;
  sure: boolean | null; // null = the sighting has no name yet
  observedAt: string; // ISO
  place: PlaceMatch | null;
  count: number | null;
  notes: string;
  details: Record<string, string>;
  media: UploadItem[];
};

export function AddForm({
  initial,
  startSpecies,
  reviewer = false,
}: {
  initial?: ObservationInitial;
  startSpecies?: SpeciesMatch | null;
  reviewer?: boolean;
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveObservation, {});
  const [media, setMedia] = useState<UploadItem[]>(initial?.media ?? []);
  const [species, setSpecies] = useState<SpeciesMatch | null>(initial?.species ?? startSpecies ?? null);
  const [speciesGuess, setSpeciesGuess] = useState(initial?.speciesGuess ?? "");
  const [sure, setSure] = useState<boolean | null>(initial?.sure ?? null);
  const [place, setPlace] = useState<PlaceMatch | null>(initial?.place ?? null);
  const [placeNote, setPlaceNote] = useState<string | null>(null);
  const [when, setWhen] = useState(() => toLocalInput(initial ? new Date(initial.observedAt) : new Date()));
  const [count, setCount] = useState(initial?.count ? String(initial.count) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [details, setDetails] = useState<Record<string, string>>(initial?.details ?? {});
  const [showDetails, setShowDetails] = useState(() => Object.values(initial?.details ?? {}).some(Boolean));
  // When editing, never overwrite the saved date or place with a new photo's EXIF data.
  const touched = useRef({ when: !!initial, place: !!initial });

  // Use the first photo's date and GPS, unless the person has already filled those in.
  function onMediaChange(items: UploadItem[]) {
    setMedia(items);
    const withDate = items.find((i) => i.takenAt);
    if (withDate?.takenAt && !touched.current.when) {
      touched.current.when = true;
      setWhen(toLocalInput(new Date(withDate.takenAt)));
    }
    const withGps = items.find((i) => i.lat !== undefined && i.lng !== undefined);
    if (withGps && !touched.current.place) {
      touched.current.place = true;
      const lat = withGps.lat!, lng = withGps.lng!;
      setPlace({ name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
      setPlaceNote("Taken from the photo's location.");
      fetch(`/api/places?lat=${lat}&lng=${lng}`)
        .then((r) => r.json())
        .then((b) => b.results?.[0] && setPlace((cur) => (cur && cur.lat === lat ? b.results[0] : cur)))
        .catch(() => {});
    }
  }

  const uploading = media.some((m) => m.status === "uploading");
  const failed = media.some((m) => m.status === "error");

  const whenDate = when ? new Date(when) : null;
  const whenIso = whenDate && !isNaN(+whenDate) ? whenDate.toISOString() : "";

  const payload: ObservationInput = {
    id: initial?.id,
    species,
    speciesGuess,
    sure: sure === true,
    observedAt: whenIso,
    place,
    count: count ? Number(count) : null,
    notes,
    details,
    media: media
      .filter((m) => m.status === "done" && m.key)
      .map((m) => ({ key: m.key!, kind: m.kind, mime: m.mime, size: m.size, takenAt: m.takenAt, lat: m.lat, lng: m.lng, mediaId: m.mediaId })),
  };

  return (
    <form action={action}>
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <Card className="max-w-2xl space-y-6">
        <MediaUploader onChange={onMediaChange} initial={initial?.media} />

        <div>
          <Label htmlFor="species">Species</Label>
          <SpeciesSearch value={species} onSelect={setSpecies} onQueryChange={setSpeciesGuess} initialQuery={initial?.speciesGuess} />
          <p className="mt-1.5 text-xs text-muted">
            No idea? Leave it, or type what you think it is, and the team can help identify it.
          </p>
          {species && (
            <div className="mt-3">
              <SureChoice value={sure} onChange={setSure} reviewer={reviewer} />
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="place">Place</Label>
          <PlaceSearch
            value={place}
            onSelect={(p) => {
              touched.current.place = true;
              setPlace(p);
              setPlaceNote(null);
            }}
          />
          {placeNote && place && <p className="mt-1.5 text-xs text-muted">{placeNote}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div>
            <Label htmlFor="when">Date and time</Label>
            <Input
              id="when"
              type="datetime-local"
              value={when}
              max={toLocalInput(new Date())}
              onChange={(e) => {
                touched.current.when = true;
                setWhen(e.target.value);
              }}
              required
            />
          </div>
          <div>
            <Label htmlFor="count">How many</Label>
            <Input id="count" type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} placeholder="1" />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What did you see?"
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-forest-600 focus:ring-2 focus:ring-forest-100"
          />
        </div>

        <div>
          <button type="button" onClick={() => setShowDetails(!showDetails)} className="text-sm font-medium text-forest-700 hover:underline">
            {showDetails ? "Hide details ▴" : "More details ▾"}
          </button>
          {showDetails && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {whenIso && (
                <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-1.5 text-sm font-medium">Month</p>
                    <p className="rounded-lg bg-wash px-3 py-2 text-sm">{monthOf(whenIso)}</p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm font-medium">Time of day</p>
                    <p className="rounded-lg bg-wash px-3 py-2 text-sm">{timeOfDayOf(whenIso)}</p>
                  </div>
                  <p className="col-span-2 -mt-2 text-xs text-muted">Filled in from the date and time above.</p>
                </div>
              )}
              {DETAIL_FIELDS.map((f) => (
                <div key={f.name}>
                  <Label htmlFor={f.name}>{f.label}</Label>
                  <Input
                    id={f.name}
                    value={details[f.name] ?? ""}
                    onChange={(e) => setDetails({ ...details, [f.name]: e.target.value })}
                    placeholder={f.placeholder}
                    list={f.name === "weather" ? "weather-choices" : undefined}
                  />
                </div>
              ))}
              <datalist id="weather-choices">
                {WEATHER_CHOICES.map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>
            </div>
          )}
        </div>

        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        {failed && <p className="text-sm text-amber-800">Some uploads failed. Remove them (✕) or try adding them again.</p>}

        {species && sure === null && (
          <p className="text-sm text-amber-800">Please choose &ldquo;I&apos;m sure&rdquo; or &ldquo;Not sure&rdquo; for the species.</p>
        )}
        <Button type="submit" disabled={pending || uploading || (species !== null && sure === null)} className="w-full">
          {uploading ? "Waiting for uploads…" : pending ? "Saving…" : initial ? "Save changes" : "Save observation"}
        </Button>
        {initial && (
          <Link href={`/observations/${initial.id}`} className="block text-center text-sm text-muted hover:underline">
            Cancel
          </Link>
        )}
      </Card>
    </form>
  );
}
