import Link from "next/link";
import { getCurrentMember } from "@/lib/auth";
import { categoryCounts, listObservations } from "@/lib/observations";
import { SightingFilters, readFilters } from "@/components/sighting-filters";
import { ObservationCard } from "@/components/observation-card";
import { Card, PageHeader } from "@/components/ui";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const member = await getCurrentMember();
  const { type, show } = readFilters(await searchParams);
  const base = {
    needsId: show === "needs-id",
    observerId: show === "mine" ? member.id : undefined,
  };
  const [observations, counts] = await Promise.all([
    listObservations({ ...base, category: type === "all" ? undefined : type }),
    categoryCounts(base),
  ]);
  const filtered = type !== "all" || show !== "all";

  return (
    <>
      <PageHeader title="Recent sightings" />
      <SightingFilters basePath="/" type={type} show={show} counts={counts}>
        {observations.length === 0 ? (
          <Card className="py-16 text-center">
            <p className="font-medium">
              {filtered ? "Nothing here." : "No sightings yet."}
            </p>
            <p className="mt-2 text-sm text-muted">
              The team&apos;s observations appear here as photo cards.
            </p>
            <Link
              href="/add"
              className="mt-6 inline-block text-sm font-medium text-forest-700 hover:underline"
            >
              Add a sighting
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {observations.map((obs) => (
              <ObservationCard key={obs.id} obs={obs} me={member.id} />
            ))}
          </div>
        )}
      </SightingFilters>
    </>
  );
}
