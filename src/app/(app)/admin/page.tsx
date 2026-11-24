import { requireAdmin } from "@/lib/auth";
import { serviceStatus } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { changeRole } from "./actions";
import { InviteForm } from "./invite-form";
import { ResetPasswordButton } from "./reset-button";
import { BlockButton } from "./block-button";

export default async function AdminPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, name, role, created_at, blocked_at")
    .order("created_at");

  return (
    <>
      <PageHeader title="Admin" />

      <section className="mb-8">
        <h2 className="mb-3 font-medium">Add someone to the team</h2>
        <Card>
          <InviteForm />
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-medium">Team ({members?.length ?? 0})</h2>
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {(members ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="text-sm font-medium">
                    {m.name ?? "Not signed in yet"}
                    {m.blocked_at && (
                      <span className="ml-2 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-800">Blocked</span>
                    )}
                  </p>
                  <p className="text-xs text-muted">{m.email}</p>
                </div>
                {m.id === me.id ? (
                  <span className="text-sm text-muted">Admin (you)</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-4">
                  {!m.blocked_at && <ResetPasswordButton id={m.id} email={m.email} />}
                  <form action={changeRole} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <select
                      name="role"
                      defaultValue={m.role}
                      className="h-9 rounded-lg border border-line bg-paper px-2 text-sm"
                      aria-label={`Role for ${m.email}`}
                    >
                      <option value="researcher">Researcher</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="text-sm text-forest-700 hover:underline">
                      Save
                    </button>
                  </form>
                  <BlockButton id={m.id} email={m.email} blocked={Boolean(m.blocked_at)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-medium">Setup checklist</h2>
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {serviceStatus().map((s) => (
              <li key={s.name} className="flex items-center justify-between px-6 py-3 text-sm">
                <span>{s.name}</span>
                <span className={s.ok ? "text-forest-700" : "text-amber-700"}>{s.ok ? "Connected" : "Not set up"}</span>
              </li>
            ))}
          </ul>
        </Card>
        <p className="mt-2 text-xs text-muted">Shows which keys are filled in. See SETUP.md for each step.</p>
      </section>
    </>
  );
}
