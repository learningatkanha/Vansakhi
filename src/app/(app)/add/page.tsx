import { PageHeader } from "@/components/ui";
import type { SpeciesMatch } from "@/lib/gbif";
import { AddForm } from "./add-form";

/** A species handed over from the Explore page (?species=<json>), checked before use. */
function parseSpecies(raw: string | string[] | undefined): SpeciesMatch | null {
  if (typeof raw !== "string") return null;
  try {
    const s = JSON.parse(raw);
    if (typeof s?.gbifKey !== "number" || typeof s.scientificName !== "string") return null;
    const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : null);
    return { gbifKey: s.gbifKey, scientificName: s.scientificName.slice(0, 200), commonName: str(s.commonName), hindiName: str(s.hindiName), group: str(s.group) };
  } catch {
    return null;
  }
}

export default async function AddPage({ searchParams }: PageProps<"/add">) {
  const { species } = await searchParams;
  return (
    <>
      <PageHeader title="Add observation" />
      <AddForm startSpecies={parseSpecies(species)} />
    </>
  );
}
