import { notFound, redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { getEntry, toDaySighting } from "@/lib/journal";
import { listObservations } from "@/lib/observations";
import { EntryForm } from "../../entry-form";

export default async function EditEntryPage({ params }: PageProps<"/journal/[id]/edit">) {
  const { id } = await params;
  const [member, entry] = await Promise.all([getCurrentMember(), getEntry(id)]);
  if (!entry) notFound();
  if (entry.owner_id !== member.id) redirect(`/journal/${id}`);
  const sightings = await listObservations({ ids: entry.observationIds }, 100);

  return (
    <EntryForm
      initial={{
        id: entry.id,
        title: entry.title,
        body: entry.body,
        entryDate: entry.entry_date,
        place: entry.place_name && entry.lat !== null && entry.lng !== null ? { name: entry.place_name, lat: entry.lat, lng: entry.lng } : null,
        weather: entry.weather ?? "",
        tags: entry.tags.join(", "),
        isShared: entry.is_shared,
        observationIds: entry.observationIds,
      }}
      initialSightings={sightings.map((o) => toDaySighting(o, member.id))}
    />
  );
}
