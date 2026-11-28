import { PageHeader } from "@/components/ui";
import { getCurrentMember } from "@/lib/auth";
import { toDaySighting } from "@/lib/journal";
import { getObservation } from "@/lib/observations";
import { CreationForm } from "../creation-form";

/** Make something for the Adda. ?obs=<sighting> starts with that sighting as the inspiration. */
export default async function NewCreationPage({ searchParams }: PageProps<"/adda/new">) {
  const member = await getCurrentMember();
  const { obs } = await searchParams;
  const sighting = typeof obs === "string" && /^[0-9a-f-]{36}$/i.test(obs) ? await getObservation(obs).catch(() => null) : null;
  return (
    <>
      <PageHeader title="Add to the Creative Adda" />
      <CreationForm
        initial={{
          kind: null,
          title: "",
          textBody: "",
          movedNote: "",
          linkUrl: "",
          photos: [],
          audio: null,
          sightings: sighting ? [toDaySighting(sighting, member.id)] : [],
        }}
      />
    </>
  );
}
