import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getCurrentMember } from "@/lib/auth";
import { getCreation } from "@/lib/creations";
import { toDaySighting } from "@/lib/journal";
import { listObservations } from "@/lib/observations";
import { CreationForm } from "../../creation-form";

export default async function EditCreationPage({ params }: PageProps<"/adda/[id]/edit">) {
  const member = await getCurrentMember();
  const { id } = await params;
  const creation = await getCreation(id);
  if (!creation) notFound();
  if (creation.author_id !== member.id) redirect(`/adda/${id}`);
  const sightings = await listObservations({ ids: creation.sightingIds }, 20);
  const audio = creation.media.find((m) => m.media_type === "audio");
  return (
    <>
      <PageHeader title="Edit creation" />
      <CreationForm
        initial={{
          id: creation.id,
          kind: creation.kind,
          title: creation.title,
          textBody: creation.text_body ?? "",
          movedNote: creation.moved_note ?? "",
          linkUrl: creation.link_url ?? "",
          photos: creation.media
            .filter((m) => m.media_type !== "audio")
            .map((m) => ({
              id: m.id,
              name: "",
              kind: m.media_type === "video" ? ("video" as const) : ("photo" as const),
              previewUrl: m.url ?? "",
              status: "done" as const,
              progress: 100,
              mime: "",
              size: 0,
              mediaId: m.id,
            })),
          audio: audio?.url ? { mediaId: audio.id, url: audio.url } : null,
          sightings: sightings.map((s) => toDaySighting(s, member.id)),
        }}
      />
    </>
  );
}
