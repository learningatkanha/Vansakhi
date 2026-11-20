"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Input, Label } from "@/components/ui";
import { PlaceSearch } from "@/components/place-search";
import { JournalEditor } from "@/components/journal-editor";
import type { PlaceMatch } from "@/lib/places";
import { todayIST, type DocNode } from "@/lib/journal-doc";
import { saveEntry, sightingsOnDay, type DaySighting, type EntryInput, type SaveState } from "./actions";

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

export function EntryForm({ initial }: { initial: EntryFormValues }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveEntry, {});
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState<DocNode>(initial.body);
  const [entryDate, setEntryDate] = useState(initial.entryDate);
  const [place, setPlace] = useState<PlaceMatch | null>(initial.place);
  const [weather, setWeather] = useState(initial.weather);
  const [tags, setTags] = useState(initial.tags);
  const [isShared, setIsShared] = useState(initial.isShared);
  const [linked, setLinked] = useState<string[]>(initial.observationIds);
  const [sightings, setSightings] = useState<DaySighting[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const pickedByHand = useRef(initial.id !== null);
  const dirty = useRef(false);

  // Offer the sightings you made on the entry's date. A new entry links all of them until you untick one.
  useEffect(() => {
    let live = true;
    sightingsOnDay(entryDate)
      .then((list) => {
        if (!live) return;
        setSightings(list);
        if (!pickedByHand.current) setLinked(list.map((s) => s.id));
      })
      .catch(() => live && setSightings([]));
    return () => {
      live = false;
    };
  }, [entryDate]);

  // Warn before leaving with unsaved writing.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current && !pending) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  const touch = () => (dirty.current = true);
  const otherDays = sightings ? linked.filter((id) => !sightings.some((s) => s.id === id)).length : 0;

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
              if (e.target.value) setEntryDate(e.target.value);
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
          <p className="mb-1.5 text-sm font-medium">Sightings that day</p>
          {sightings === null && <p className="text-xs text-muted">Looking…</p>}
          {sightings?.length === 0 && <p className="text-xs text-muted">You recorded no sightings on this date.</p>}
          {sightings && sightings.length > 0 && (
            <ul className="space-y-1.5">
              {sightings.map((s) => {
                const on = linked.includes(s.id);
                return (
                  <li key={s.id}>
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-1.5 text-sm ${on ? "border-forest-600 bg-forest-50" : "border-line bg-paper"}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          touch();
                          pickedByHand.current = true;
                          setLinked(on ? linked.filter((x) => x !== s.id) : [...linked, s.id]);
                        }}
                        className="accent-forest-600"
                      />
                      {s.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.thumb} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="h-9 w-9 shrink-0 rounded bg-wash" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {s.time}
                          {s.place ? ` · ${s.place}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {otherDays > 0 && (
            <p className="mt-1.5 text-xs text-muted">
              Also linked: {otherDays} sighting{otherDays > 1 ? "s" : ""} from other days.{" "}
              <button
                type="button"
                className="text-forest-700 hover:underline"
                onClick={() => {
                  touch();
                  setLinked(linked.filter((id) => sightings?.some((s) => s.id === id)));
                }}
              >
                Unlink
              </button>
            </p>
          )}
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
            <span className="block text-xs text-muted">Off: only you can see this entry.</span>
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
