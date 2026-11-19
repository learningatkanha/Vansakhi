import { getCurrentMember } from "@/lib/auth";
import { NameForm } from "./name-form";

export default async function WelcomePage() {
  const member = await getCurrentMember();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold">Welcome to the team</h1>
        <p className="mt-2 text-center text-sm text-muted">One quick thing before you start.</p>
        <div className="mt-8 rounded-xl border border-line bg-paper p-6">
          <NameForm initial={member.name ?? ""} />
        </div>
      </div>
    </main>
  );
}
