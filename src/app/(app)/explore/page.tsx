import { Card, Label, PageHeader } from "@/components/ui";
import { getCurrentMember } from "@/lib/auth";
import { formatWhen } from "@/lib/media";
import { categoryCounts, listObservations, myRecentSightings } from "@/lib/observations";
import { ObservationCard } from "@/components/observation-card";
import { SightingFilters, readFilters } from "@/components/sighting-filters";
import { ExploreSpecies } from "./explore-species";
import { isReviewerRole } from "@/lib/id-status";

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const member = await getCurrentMember();
  const { type, show } = readFilters(await searchParams);
  const base = { needsId: show === "needs-id", observerId: show === "mine" ? member.id : undefined };
  const [mine, observations, counts] = await Promise.all([
    myRecentSightings(member.id),
    listObservations({ ...base, category: type === "all" ? undefined : type }, 96),
    categoryCounts(base),
  ]);
  const sightings = mine.map((s) => ({
    id: s.id,
    title: s.title,
    dateLabel: formatWhen(s.observedAt, false),
    place: s.place,
    named: s.named,
  }));

  return (
    <>
      <PageHeader title="Explore" />
      <Card className="mb-8 max-w-xl">
        <Label htmlFor="species">Look up any species</Label>
        <ExploreSpecies sightings={sightings} reviewer={isReviewerRole(member.role)} />
        <p className="mt-3 text-xs text-muted">Suggestions come from iNaturalist, with species recorded in India listed first.</p>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">The team&apos;s sightings</h2>
      <SightingFilters basePath="/explore" type={type} show={show} counts={counts} />
      {observations.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="font-medium">Nothing here yet.</p>
          <p className="mt-2 text-sm text-muted">Try another tab, or Everyone.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {observations.map((obs) => (
            <ObservationCard key={obs.id} obs={obs} me={member.id} />
          ))}
        </div>
      )}
      <p className="mt-8 text-sm text-muted">Coming later: a map view, a list view, and filters by date, place or person.</p>
    </>
  );
}
