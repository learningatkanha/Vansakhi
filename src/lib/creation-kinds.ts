/** Kinds of creation in Creative Adda, how they're described, and which gallery tab each belongs to. */

export const KINDS = [
  { key: "painting", label: "Painting or drawing", short: "Painting", hint: "Upload photos of your artwork.", media: "photo" },
  { key: "story", label: "Written story", short: "Story", hint: "Write it here, in English or Hindi.", media: null },
  { key: "poem", label: "Written poem", short: "Poem", hint: "Write it here; your line breaks are kept.", media: null },
  { key: "audio_story", label: "Audio story", short: "Audio story", hint: "Record it here, or upload a recording.", media: "audio" },
  { key: "audio_poem", label: "Audio poem", short: "Audio poem", hint: "Record it here, or upload a recording.", media: "audio" },
  { key: "other", label: "Something else", short: "Creation", hint: "A song, sculpture, video… add photos, a recording or a link.", media: "any" },
] as const;

export type CreationKind = (typeof KINDS)[number]["key"];
export type KindTab = "all" | "paintings" | "stories" | "poems" | "audio" | "others";

export const KIND_GROUP: Record<CreationKind, Exclude<KindTab, "all">> = {
  painting: "paintings",
  story: "stories",
  poem: "poems",
  audio_story: "audio",
  audio_poem: "audio",
  other: "others",
};

export const KIND_TABS: { key: KindTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "paintings", label: "Paintings" },
  { key: "stories", label: "Stories" },
  { key: "poems", label: "Poems" },
  { key: "audio", label: "Audio" },
  { key: "others", label: "Others" },
];

export const isKind = (v: unknown): v is CreationKind => KINDS.some((k) => k.key === v);
export const kindInfo = (k: CreationKind) => KINDS.find((x) => x.key === k)!;
export const isWritten = (k: CreationKind) => k === "story" || k === "poem";
