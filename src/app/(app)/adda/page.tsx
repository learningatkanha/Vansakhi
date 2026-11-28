import Link from "next/link";
import { CreationCard } from "@/components/creation-card";
import { FolderTabs } from "@/components/folder-tabs";
import { Card, PageHeader } from "@/components/ui";
import { getCurrentMember } from "@/lib/auth";
import { KIND_TABS, type KindTab } from "@/lib/creation-kinds";
import { creationCounts, inspiringSightings, listCreations } from "@/lib/creations";

/** Creative Adda: the team's paintings, stories, poems and recordings, inspired by sightings or by Kanha. */
export default async function AddaPage({ searchParams }: PageProps<"/adda">) {
  const member = await getCurrentMember();
  const { kind } = await searchParams;
  const tab = (KIND_TABS.find((t) => t.key === kind)?.key ?? "all") as KindTab;
  const [creations, counts] = await Promise.all([listCreations(tab), creationCounts()]);
  // The sightings behind the creations on this tab, for "Inspired by" on each card.
  const sightings = await inspiringSightings([...new Set(creations.flatMap((c) => c.sightingIds))]);
  const byId = new Map(sightings.map((s) => [s.id, s]));

  return (
    <>
      <PageHeader title="Creative Adda">
        <Link
          href="/adda/new"
          className="inline-flex h-10 items-center rounded-full bg-forest-600 px-5 text-sm font-medium text-white hover:bg-forest-700"
        >
          + Add a creation
        </Link>
      </PageHeader>
      <p className="-mt-3 mb-6 max-w-2xl font-serif text-lg italic text-muted">
        Paintings, stories, poems and recordings from the team, inspired by what we see in Kanha.
      </p>

      <FolderTabs
        label="Kind of creation"
        active={tab}
        tabs={KIND_TABS.filter((t) => t.key === "all" || t.key === tab || counts[t.key] > 0).map((t) => ({
          key: t.key,
          label: t.label,
          count: counts[t.key],
          href: t.key === "all" ? "/adda" : `/adda?kind=${t.key}`,
        }))}
      >
        {creations.length === 0 ? (
          <Card className="border-0 py-14 text-center">
            <p className="font-serif text-xl font-medium">{tab === "all" ? "The Adda is waiting for its first creation" : "Nothing here yet"}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Paint a sighting, write a poem about a dusk in the meadow, or record the story a guide told you.
            </p>
            <Link href="/adda/new" className="mt-6 inline-block text-sm font-medium text-forest-700 hover:underline">
              Add a creation
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {creations.map((c) => (
              <CreationCard key={c.id} c={c} me={member.id} inspiredBy={c.sightingIds.flatMap((id) => byId.get(id) ?? [])} />
            ))}
          </div>
        )}
      </FolderTabs>
    </>
  );
}
