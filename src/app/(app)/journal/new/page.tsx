import { getCurrentMember } from "@/lib/auth";
import { EMPTY_DOC, istDateOf, todayIST } from "@/lib/journal-doc";
import { toDaySighting } from "@/lib/journal";
import { getObservation } from "@/lib/observations";
import { EntryForm } from "../entry-form";

export default async function NewEntryPage({ searchParams }: PageProps<"/journal/new">) {
  const member = await getCurrentMember();
  const { obs: obsId } = await searchParams;

  // Writing about a sighting: start from its day and place, with it already linked.
  const obs = typeof obsId === "string" ? await getObservation(obsId) : null;
  const obsDate = obs ? istDateOf(obs.observed_at) : null;
  const entryDate = obsDate && obsDate <= todayIST() ? obsDate : todayIST();

  return (
    <EntryForm
      initial={{
        id: null,
        title: obs ? obs.title : "",
        body: EMPTY_DOC,
        entryDate,
        place: obs?.place_name && obs.lat !== null && obs.lng !== null ? { name: obs.place_name, lat: obs.lat, lng: obs.lng } : null,
        weather: obs?.weather ?? "",
        tags: "",
        isShared: true,
        observationIds: obs ? [obs.id] : [],
      }}
      initialSightings={obs ? [toDaySighting(obs, member.id)] : []}
    />
  );
}
