"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, Input, Label } from "@/components/ui";
import { PlaceSearch } from "@/components/place-search";
import { JournalEditor } from "@/components/journal-editor";
import type { PlaceMatch } from "@/lib/places";
import { todayIST, type DocNode } from "@/lib/journal-doc";
import type { DaySighting } from "@/lib/journal";
import { saveEntry, sightingsOnDay, type EntryInput, type SaveState } from "./actions";

export type EntryFormValues = {
  id: string | null;
  title: string;
  body: DocNode;
  entryDate: string;
  place: PlaceMatch | null;
  weather: string;
  tags: string;
  isShared: boolean;
  observationIds: string[];
};

function SightingRow({ s, children }: { s: DaySighting; children?: ReactNode }) {
  return (
    <>
      {s.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.thumb} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
      ) : (
        <span className="h-9 w-9 shrink-0 rounded bg-wash" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{s.title}</span>
        <span className="block truncate text-xs text-muted">
          {s.when}
          {s.place ? ` · ${s.place}` : ""}
          {s.by ? ` · ${s.by}` : ""}
        </span>
      </span>
      {children}
    </>
  );
}

export function EntryForm({ initial, initialSightings }: { initial: EntryFormValues; initialSightings: DaySighting[] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveEntry, {});
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState<DocNode>(initial.body);
  const [entryDate, setEntryDate] = useState(initial.entryDate);
  const [place, setPlace] = useState<PlaceMatch | null>(initial.place);
  const [weather, setWeather] = useState(initial.weather);
  const [tags, setTags] = useState(initial.tags);
  const [isShared, setIsShared] = useState(initial.isShared);
  const [linked, setLinked] = useState<string[]>(initial.observationIds);
  // Every sighting we have details for, so linked ones from other days still show their name and photo.
  const [known, setKnown] = useState<Record<string, DaySighting>>(() => Object.fromEntries(initialSightings.map((s) => [s.id, s])));
  const [browseDate, setBrowseDate] = useState(initial.entryDate);
  const [day, setDay] = useState<{ date: string; list: DaySighting[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  // A new entry links your own sightings from its date, until you pick by hand or it came from a sighting.
  const pickedByHand = useRef(initial.id !== null || initial.observationIds.length > 0);
  const dirty = useRef(false);

  useEffect(() => {
    let live = true;
    sightingsOnDay(browseDate)
      .then((list) => {
        if (!live) return;
        setDay({ date: browseDate, list });
        setKnown((k) => ({ ...k, ...Object.fromEntries(list.map((s) => [s.id, s])) }));
        if (!pickedByHand.current) setLinked(list.filter((s) => s.by === null).map((s) => s.id));
      })
      .catch(() => live && setDay({ date: browseDate, list: [] }));
    return () => {
      live = false;
    };
  }, [browseDate]);

  // Warn before leaving with unsaved writing.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current && !pending) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  const touch = () => (dirty.current = true);
  const toggle = (id: string) => {
    touch();
    pickedByHand.current = true;
    setLinked(linked.includes(id) ? linked.filter((x) => x !== id) : [...linked, id]);
  };
  const dayList = day && day.date === browseDate ? day.list : null;

  const payload: EntryInput = {
    id: initial.id,
    title,
    body,
    entryDate,
    place,
    weather,
    tags,
    isShared,
    observationIds: linked,
  };

  return (
    <form
      action={action}
      onSubmit={() => {
        dirty.current = false;
      }}
      className="grid gap-8 lg:grid-cols-[1fr_18rem]"
    >
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <div className="min-w-0 rounded-xl border border-line bg-paper px-6 pb-8 pt-5">
        <input
          value={title}
          onChange={(e) => {
            touch();
            setTitle(e.target.value);
          }}
          placeholder="Title"
          aria-label="Title"
          maxLength={200}
          className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-muted/60"
        />
        <div className="mt-3">
          <JournalEditor
            initial={initial.body}
            onChange={(doc) => {
              touch();
              setBody(doc);
            }}
            onBusyChange={setUploading}
          />
        </div>
      </div>

      <aside className="space-y-5">
        <div>
          <Label htmlFor="entry-date">Date</Label>
          <Input
            id="entry-date"
            type="date"
            value={entryDate}
            max={todayIST()}
            required
            onChange={(e) => {
              touch();
              if (e.target.value) {
                setEntryDate(e.target.value);
                setBrowseDate(e.target.value);
              }
            }}
          />
        </div>

        <div>
          <Label htmlFor="entry-place">Place</Label>
          <PlaceSearch
            id="entry-place"
            value={place}
            onSelect={(p) => {
              touch();
              setPlace(p);
            }}
          />
        </div>

        <div>
          <Label htmlFor="entry-weather">Weather</Label>
          <Input
            id="entry-weather"
            value={weather}
            maxLength={200}
            placeholder="clear, misty, light rain…"
            onChange={(e) => {
              touch();
              setWeather(e.target.value);
            }}
          />
        </div>

        <div>
          <Label htmlFor="entry-tags">Tags</Label>
          <Input
            id="entry-tags"
            value={tags}
            placeholder="birds, waterhole, tiger"
            onChange={(e) => {
              touch();
              setTags(e.target.value);
            }}
          />
          <p className="mt-1 text-xs text-muted">Separate with commas.</p>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium">Linked sightings</p>
          {linked.length === 0 && <p className="text-xs text-muted">None yet. Tick sightings below to link them.</p>}
          {linked.length > 0 && (
            <ul className="space-y-1.5">
              {linked.map((id) => {
                const s = known[id] ?? { id, title: "A sighting", when: "", thumb: null, place: null, by: null };
                return (
                  <li key={id} className="flex items-center gap-2 rounded-lg border border-forest-600 bg-forest-50 p-1.5 text-sm">
                    <SightingRow s={s}>
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        aria-label={`Unlink ${s.title}`}
                        title="Unlink"
                        className="shrink-0 rounded-full px-2 text-lg leading-none text-muted hover:text-ink"
                      >
                        ×
                      </button>
                    </SightingRow>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <Label htmlFor="browse-date">Find sightings by day</Label>
          <Input
            id="browse-date"
            type="date"
            value={browseDate}
            max={todayIST()}
            onChange={(e) => {
              if (!e.target.value) return;
              pickedByHand.current = true;
              setBrowseDate(e.target.value);
            }}
          />
          <div className="mt-2">
            {dayList === null && <p className="text-xs text-muted">Looking…</p>}
            {dayList?.length === 0 && <p className="text-xs text-muted">No sightings were recorded on this day.</p>}
            {dayList && dayList.length > 0 && (
              <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                {dayList.map((s) => {
                  const on = linked.includes(s.id);
                  return (
                    <li key={s.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-1.5 text-sm ${on ? "border-forest-600 bg-forest-50" : "border-line bg-paper"}`}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="accent-forest-600" />
                        <SightingRow s={s} />
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-paper p-3 text-sm">
          <input
            type="checkbox"
            checked={isShared}
            onChange={(e) => {
              touch();
              setIsShared(e.target.checked);
            }}
            className="mt-0.5 accent-forest-600"
          />
          <span>
            <span className="font-medium">Share with the team</span>
            <span className="block text-xs text-muted">Untick to keep this entry to yourself.</span>
          </span>
        </label>

        {state.error && <p className="text-sm text-red-700">{state.error}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending || uploading} className="flex-1">
            {uploading ? "Waiting for uploads…" : pending ? "Saving…" : "Save entry"}
          </Button>
          <Link href={initial.id ? `/journal/${initial.id}` : "/journal"} className="text-sm text-muted hover:underline">
            Cancel
          </Link>
        </div>
      </aside>
    </form>
  );
}
