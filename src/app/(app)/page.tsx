import Link from "next/link";
import { getCurrentMember } from "@/lib/auth";
import { listObservations } from "@/lib/observations";
import { ObservationCard } from "@/components/observation-card";
import { Card, PageHeader } from "@/components/ui";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "needs-id", label: "Needs ID" },
  { key: "mine", label: "Mine" },
] as const;

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const member = await getCurrentMember();
  const { show } = await searchParams;
  const active = FILTERS.find((f) => f.key === show)?.key ?? "all";
  const observations = await listObservations({
    needsId: active === "needs-id",
    observerId: active === "mine" ? member.id : undefined,
  });

  return (
    <>
      <PageHeader title="Recent sightings">
        <div className="flex gap-2 text-sm">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/" : `/?show=${f.key}`}
              className={`rounded-full border px-3 py-1 ${
                active === f.key ? "border-forest-600 bg-forest-50" : "border-line bg-paper text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </PageHeader>

      {observations.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="font-medium">{active === "all" ? "No sightings yet." : "Nothing here."}</p>
          <p className="mt-2 text-sm text-muted">The team&apos;s observations appear here as photo cards.</p>
          <Link href="/add" className="mt-6 inline-block text-sm font-medium text-forest-700 hover:underline">
            Add the first one →
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {observations.map((obs) => (
            <ObservationCard key={obs.id} obs={obs} me={member.id} />
          ))}
        </div>
      )}
    </>
  );
}
