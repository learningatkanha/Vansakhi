import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { TopBar } from "@/components/top-bar";
import { isReviewerRole } from "@/lib/id-status";
import { reviewCounts } from "@/lib/observations";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const member = await getCurrentMember();
  if (!member.name) redirect("/welcome");
  // Researchers and admins see a Review link with how many sightings wait for them (Needs ID + Named).
  let reviewWaiting: number | null = null;
  if (isReviewerRole(member.role)) {
    const c = await reviewCounts().catch(() => null);
    reviewWaiting = c ? c["needs-id"] + c.named : 0;
  }

  return (
    <>
      <TopBar member={member} reviewWaiting={reviewWaiting} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
