"use client";

import { useActionState, useEffect, useState } from "react";
import { AudioInput, type AudioValue } from "@/components/audio-input";
import { MediaUploader, type UploadItem } from "@/components/media-uploader";
import { Button, Input, Label } from "@/components/ui";
import { KINDS, isWritten, type CreationKind } from "@/lib/creation-kinds";
import type { DaySighting } from "@/lib/journal";
import { findSightings } from "../journal/actions";
import { saveCreation, type CreationInput, type CreationSaveState } from "./actions";

export type CreationInitial = {
  id?: string;
  kind: CreationKind | null;
  title: string;
  textBody: string;
  movedNote: string;
  linkUrl: string;
  photos: UploadItem[];
  audio: AudioValue | null;
  sightings: DaySighting[];
};

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function CreationForm({ initial }: { initial: CreationInitial }) {
  const [state, action, pending] = useActionState<CreationSaveState, FormData>(saveCreation, {});
  const [kind, setKind] = useState<CreationKind | null>(initial.kind);
  const [title, setTitle] = useState(initial.title);
  const [textBody, setTextBody] = useState(initial.textBody);
  const [linkUrl, setLinkUrl] = useState(initial.linkUrl);
  const [photos, setPhotos] = useState<UploadItem[]>(initial.photos);
  const [audio, setAudio] = useState<AudioValue | null>(initial.audio);
  const [audioBusy, setAudioBusy] = useState(false);
  const [sightings, setSightings] = useState<DaySighting[]>(initial.sightings);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<DaySighting[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Search the team's sightings from any day, a moment after typing stops.
  useEffect(() => {
    if (!searching) return;
    let live = true;
    const t = setTimeout(() => {
      findSightings(query.trim(), today())
        .then((list) => live && setFound(list))
        .catch(() => live && setFound([]));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, searching]);

  const info = KINDS.find((k) => k.key === kind);
  const usesPhotos = kind === "painting" || kind === "other";
  const usesAudio = kind === "audio_story" || kind === "audio_poem" || kind === "other";
  const usesText = kind !== null && (isWritten(kind) || kind === "other");
  const uploading = photos.some((p) => p.status === "uploading") || audioBusy;

  const input: CreationInput | null = kind
    ? {
        id: initial.id,
        kind,
        title,
        textBody: usesText ? textBody : "",
        movedNote: initial.movedNote,
        linkUrl: kind === "other" ? linkUrl : "",
        media: [
          ...(usesPhotos
            ? photos
                .filter((p) => p.status === "done")
                .map((p) => ({ mediaId: p.mediaId, key: p.key, kind: p.kind, mime: p.mime, size: p.size }))
            : []),
          ...(usesAudio && audio ? [{ mediaId: audio.mediaId, key: audio.key, kind: "audio" as const, mime: audio.mime, size: audio.size }] : []),
        ],
        sightingIds: sightings.map((s) => s.id),
      }
    : null;

  return (
    <form action={action} className="max-w-2xl space-y-8">
      {input && <input type="hidden" name="input" value={JSON.stringify(input)} />}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">What have you made?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {KINDS.map((k) => {
            const on = kind === k.key;
            return (
              <button
                key={k.key}
                type="button"
                aria-pressed={on}
                onClick={() => setKind(k.key)}
                className={`rounded-lg border p-3 text-left text-sm ${on ? "border-forest-600 bg-forest-50" : "border-line bg-paper hover:bg-wash"}`}
              >
                <span className={`block font-serif text-base font-semibold ${on ? "text-forest-800" : ""}`}>{k.label}</span>
              </button>
            );
          })}
        </div>
        {info && <p className="mt-2 text-sm text-muted">{info.hint}</p>}
      </fieldset>

      {kind && (
        <>
          <div>
            <Label htmlFor="creation-title">Title</Label>
            <input
              id="creation-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "poem" || kind === "audio_poem" ? "Barasingha at dusk" : "The night the frogs sang"}
              className="w-full border-b-2 border-line bg-transparent pb-1 font-serif text-2xl font-semibold outline-none placeholder:font-normal placeholder:text-muted/70 focus:border-forest-600"
            />
          </div>

          {usesPhotos && (
            <div>
              <Label>{kind === "painting" ? "Photos of your artwork" : "Photos or videos (optional)"}</Label>
              <MediaUploader onChange={setPhotos} initial={initial.photos} />
            </div>
          )}

          {usesAudio && (
            <div>
              <Label>{kind === "other" ? "A recording (optional)" : "Your recording"}</Label>
              <AudioInput value={audio} onChange={setAudio} onBusy={setAudioBusy} />
            </div>
          )}

          {usesText && (
            <div>
              <Label htmlFor="creation-text">{kind === "poem" ? "Your poem" : kind === "story" ? "Your story" : "Words (optional)"}</Label>
              <textarea
                id="creation-text"
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                rows={kind === "other" ? 4 : 14}
                className="w-full rounded-lg border border-line bg-paper p-4 font-serif text-lg leading-relaxed outline-none focus:border-forest-600 focus:ring-2 focus:ring-forest-100"
                placeholder={kind === "poem" ? "Write line by line. Your line breaks and spacing are kept." : ""}
              />
            </div>
          )}

          {kind === "other" && (
            <div>
              <Label htmlFor="creation-link">Link (optional)</Label>
              <Input id="creation-link" type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://youtu.be/…" />
              <p className="mt-1 text-xs text-muted">For a song, video or anything that lives elsewhere.</p>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium">Inspired by</p>
            {sightings.length === 0 ? (
              <p className="mb-2 text-sm text-muted">Kanha in general. Add sightings below if a particular moment inspired it.</p>
            ) : (
              <ul className="mb-2 flex flex-wrap gap-2">
                {sightings.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-full border border-forest-600 bg-forest-50 py-1 pl-1 pr-3 text-sm">
                    {s.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumb} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="h-7 w-7 rounded-full bg-wash" />
                    )}
                    <span className="max-w-48 truncate">{s.title}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${s.title}`}
                      onClick={() => setSightings((x) => x.filter((y) => y.id !== s.id))}
                      className="text-muted hover:text-red-700"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="relative">
              <Input
                type="search"
                value={query}
                autoComplete="off"
                placeholder="Find a sighting by name or place, anyone's"
                onFocus={() => setSearching(true)}
                onBlur={() => setTimeout(() => setSearching(false), 150)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearching(true);
                }}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              />
              {searching && (
                <ul className="absolute inset-x-0 top-11 z-20 max-h-72 overflow-y-auto rounded-lg border border-line bg-paper p-1.5 shadow-lg">
                  {found === null && <li className="p-1.5 text-sm text-muted">Looking…</li>}
                  {found?.length === 0 && <li className="p-1.5 text-sm text-muted">No sightings match.</li>}
                  {found?.map((s) => {
                    const on = sightings.some((x) => x.id === s.id);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setSightings((x) => (on ? x.filter((y) => y.id !== s.id) : [...x, s]))}
                          className={`flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm ${on ? "bg-forest-50" : "hover:bg-wash"}`}
                        >
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
                              {s.place ? `, ${s.place}` : ""}
                              {s.by ? `, ${s.by}` : ""}
                            </span>
                          </span>
                          <span className={`text-xs ${on ? "font-medium text-forest-700" : "text-muted"}`}>{on ? "✓ Added" : "Add"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {state.error && <p className="text-sm text-red-700">{state.error}</p>}
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={pending || uploading || !title.trim()}>
              {pending ? "Posting…" : uploading ? "Waiting for uploads…" : initial.id ? "Save changes" : "Post to the Adda"}
            </Button>
            {!initial.id && <p className="text-xs text-muted">Everyone on the team will see it.</p>}
          </div>
        </>
      )}
    </form>
  );
}
