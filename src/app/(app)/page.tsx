import Link from "next/link";
import { getCurrentMember } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";

export default async function HomePage() {
  const member = await getCurrentMember();
  return (
    <>
      <PageHeader title="Recent sightings">
        <div className="flex gap-2 text-sm">
          <span className="rounded-full border border-forest-600 bg-forest-50 px-3 py-1">All</span>
          <span className="rounded-full border border-line bg-paper px-3 py-1 text-muted">Needs ID</span>
          <span className="rounded-full border border-line bg-paper px-3 py-1 text-muted">Mine</span>
        </div>
      </PageHeader>
      <Card className="py-16 text-center">
        <p className="font-medium">Welcome, {member.name?.split(" ")[0]}.</p>
        <p className="mt-2 text-sm text-muted">No sightings yet. The team&apos;s observations will appear here as photo cards.</p>
        <Link href="/add" className="mt-6 inline-block text-sm font-medium text-forest-700 hover:underline">
          Try the add form →
        </Link>
      </Card>
    </>
  );
}
