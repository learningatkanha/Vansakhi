import { Card, ComingSoon, Label, PageHeader } from "@/components/ui";
import { SpeciesSearch } from "@/components/species-search";

export default function ExplorePage() {
  return (
    <>
      <PageHeader title="Explore" />
      <Card className="mb-6 max-w-xl">
        <Label htmlFor="species">Look up any species</Label>
        <SpeciesSearch />
        <p className="mt-3 text-xs text-muted">Names come from GBIF, the free worldwide species database.</p>
      </Card>
      <ComingSoon phase={4}>The team&apos;s sightings on a map, grid or list, with one filter bar.</ComingSoon>
    </>
  );
}
