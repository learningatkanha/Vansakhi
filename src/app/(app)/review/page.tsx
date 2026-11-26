import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { isReviewerRole } from "@/lib/id-status";
import { reviewCounts, reviewList, type ReviewTab } from "@/lib/observations";
import { ObservationCard } from "@/components/observation-card";
import { Card, PageHeader } from "@/components/ui";

const TABS: { key: ReviewTab; label: string; empty: string }[] = [
  { key: "named", label: "Named", empty: "No named sightings waiting. Everyone's sure, or a researcher has checked them." },
  { key: "needs-id", label: "Needs ID", empty: "Every sighting has a name." },
  { key: "suggestions", label: "Has suggestions", empty: "No open name suggestions." },
];

/** Researchers and admins: sightings waiting for an expert eye. Self-confirmed and Verified ones aren't listed. */
export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const member = await getCurrentMember();
  if (!isReviewerRole(member.role)) redirect("/");
  const { show } = await searchParams;
  const active = TABS.find((t) => t.key === show) ?? TABS[0];
  const [list, counts] = await Promise.all([reviewList(active.key), reviewCounts()]);

  return (
    <>
      <PageHeader title="Review">
        <div className="flex flex-wrap gap-2 text-sm">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/review?show=${t.key}`}
              className={`rounded-full border px-3 py-1 ${
                active.key === t.key ? "border-forest-600 bg-forest-50" : "border-line bg-paper text-muted hover:text-ink"
              }`}
            >
              {t.label} <span className="text-xs text-muted">{counts[t.key]}</span>
            </Link>
          ))}
        </div>
      </PageHeader>
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-muted">
        Open a sighting to verify its name, correct it, or accept a suggestion and verify it in one go.
      </p>

      {list.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="font-medium">Nothing to review here.</p>
          <p className="mt-2 text-sm text-muted">{active.empty}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {list.map((obs) => (
            <ObservationCard key={obs.id} obs={obs} me={member.id} />
          ))}
        </div>
      )}
    </>
  );
}
