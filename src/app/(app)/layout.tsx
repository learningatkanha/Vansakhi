import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { TopBar } from "@/components/top-bar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const member = await getCurrentMember();
  if (!member.name) redirect("/welcome");

  return (
    <>
      <TopBar member={member} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
