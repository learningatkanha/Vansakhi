/**
 * Type tabs: which group of living things a sighting belongs to, from the species' scientific classification
 * (species.group_name holds GBIF's class, or the kingdom when there is no class). Sightings without a species
 * picked from the list are "Not named yet".
 */
export const CATEGORIES = [
  { key: "mammals", label: "Mammals" },
  { key: "birds", label: "Birds" },
  { key: "reptiles", label: "Reptiles" },
  { key: "amphibians", label: "Amphibians" },
  { key: "insects", label: "Insects" },
  { key: "arachnids", label: "Spiders & scorpions" },
  { key: "fungi", label: "Fungi" },
  { key: "plants", label: "Plants" },
  { key: "others", label: "Others" },
  { key: "unnamed", label: "Not named yet" },
] as const;

export type Category = (typeof CATEGORIES)[number]["key"];

/** Classes (and kingdoms) in each named group. Anything else that has a species is "Others". */
export const GROUPS: Record<Exclude<Category, "others" | "unnamed">, string[]> = {
  mammals: ["Mammalia"],
  birds: ["Aves"],
  // GBIF files reptiles under several classes.
  reptiles: ["Reptilia", "Squamata", "Testudines", "Crocodylia", "Sauria"],
  amphibians: ["Amphibia"],
  insects: ["Insecta"],
  arachnids: ["Arachnida"],
  fungi: [
    "Fungi",
    "Agaricomycetes",
    "Sordariomycetes",
    "Leotiomycetes",
    "Pezizomycetes",
    "Dothideomycetes",
    "Lecanoromycetes",
    "Eurotiomycetes",
    "Tremellomycetes",
    "Dacrymycetes",
    "Pucciniomycetes",
    "Ustilaginomycetes",
    "Exobasidiomycetes",
    "Arthoniomycetes",
    "Lichinomycetes",
    "Geoglossomycetes",
    "Saccharomycetes",
  ],
  plants: [
    "Plantae",
    "Magnoliopsida",
    "Liliopsida",
    "Polypodiopsida",
    "Pinopsida",
    "Cycadopsida",
    "Gnetopsida",
    "Ginkgoopsida",
    "Lycopodiopsida",
    "Equisetopsida",
    "Bryopsida",
    "Sphagnopsida",
    "Polytrichopsida",
    "Andreaeopsida",
    "Marchantiopsida",
    "Jungermanniopsida",
    "Anthocerotopsida",
  ],
};

/** Every class/kingdom that belongs to a named group (used to find "Others"). */
export const NAMED_GROUPS = Object.values(GROUPS).flat();

export function isCategory(value: unknown): value is Category {
  return CATEGORIES.some((c) => c.key === value);
}

/** The tab for a sighting: by its species' group, or "unnamed" when no species was picked. */
export function categoryOf(species: { group_name: string | null } | null): Category {
  if (!species) return "unnamed";
  const group = species.group_name ?? "";
  for (const [key, list] of Object.entries(GROUPS)) if (list.includes(group)) return key as Category;
  return "others";
}
