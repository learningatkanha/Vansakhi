import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getCurrentMember } from "@/lib/auth";
import { getObservation } from "@/lib/observations";
import { AddForm } from "../../../add/add-form";

export default async function EditObservationPage({ params }: PageProps<"/observations/[id]/edit">) {
  const { id } = await params;
  const [member, obs] = await Promise.all([getCurrentMember(), getObservation(id)]);
  if (!obs) notFound();
  // Only the person who recorded a sighting can change it (the database enforces this too).
  if (obs.observer_id !== member.id) redirect(`/observations/${id}`);

  const s = obs.species;
  const species =
    s && s.gbif_key !== null
      ? { gbifKey: s.gbif_key, scientificName: s.scientific_name, commonName: s.common_name, hindiName: s.hindi_name, group: s.group_name }
      : null;

  return (
    <>
      <PageHeader title="Edit observation" />
      <AddForm
        initial={{
          id: obs.id,
          species,
          speciesGuess: species ? "" : (obs.species_guess ?? s?.common_name ?? s?.scientific_name ?? ""),
          observedAt: obs.observed_at,
          place: obs.place_name && obs.lat !== null && obs.lng !== null ? { name: obs.place_name, lat: obs.lat, lng: obs.lng } : null,
          count: obs.count,
          notes: obs.notes ?? "",
          details: {
            life_stage: obs.life_stage ?? "",
            sex: obs.sex ?? "",
            behaviour: obs.behaviour ?? "",
            habitat: obs.habitat ?? "",
            weather: obs.weather ?? "",
          },
          media: obs.media.map((m) => ({
            id: m.id,
            mediaId: m.id,
            name: m.file_key.split("/").pop() ?? "photo",
            kind: m.media_type === "video" ? ("video" as const) : ("photo" as const),
            previewUrl: m.url ?? "",
            status: "done" as const,
            progress: 100,
            key: m.file_key,
            mime: "",
            size: 0,
          })),
        }}
      />
    </>
  );
}
