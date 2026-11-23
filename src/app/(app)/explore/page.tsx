import { Card, ComingSoon, Label, PageHeader } from "@/components/ui";
import { getCurrentMember } from "@/lib/auth";
import { formatWhen } from "@/lib/media";
import { myRecentSightings } from "@/lib/observations";
import { ExploreSpecies } from "./explore-species";

export default async function ExplorePage() {
  const member = await getCurrentMember();
  const sightings = (await myRecentSightings(member.id)).map((s) => ({
    id: s.id,
    title: s.title,
    dateLabel: formatWhen(s.observedAt, false),
    place: s.place,
    named: s.named,
  }));

  return (
    <>
      <PageHeader title="Explore" />
      <Card className="mb-6 max-w-xl">
        <Label htmlFor="species">Look up any species</Label>
        <ExploreSpecies sightings={sightings} />
        <p className="mt-3 text-xs text-muted">Suggestions come from iNaturalist, with species recorded in India listed first.</p>
      </Card>
      <ComingSoon phase={4}>The team&apos;s sightings on a map, grid or list, with one filter bar.</ComingSoon>
    </>
  );
}
