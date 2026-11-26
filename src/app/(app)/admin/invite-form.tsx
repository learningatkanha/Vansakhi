"use client";

import { useActionState } from "react";
import { inviteMember, type InviteState } from "./actions";
import { Button, Input, Label } from "@/components/ui";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      <div>
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" name="email" type="email" required placeholder="name@example.com" />
      </div>
      <div>
        <Label htmlFor="invite-name">Name</Label>
        <Input id="invite-name" name="name" placeholder="Ravi" />
      </div>
      <div>
        <Label htmlFor="invite-role">Role</Label>
        <select id="invite-role" name="role" defaultValue="observer" className="h-10 rounded-lg border border-line bg-paper px-3 text-sm">
          <option value="observer">Observer</option>
          <option value="researcher">Researcher</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-4 sm:order-last">
        <input type="checkbox" name="sendEmail" defaultChecked className="accent-forest-600" />
        Email them an invitation (they choose their own password). Untick to get a temporary password to send yourself.
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add to team"}
      </Button>
      {state.ok && (
        <div className="rounded-lg bg-forest-50 p-3 text-sm sm:col-span-4">
          <p>{state.ok}</p>
          {state.password && (
            <>
              <p className="mt-1 font-mono text-base font-semibold">{state.password}</p>
              <p className="mt-1 text-xs text-muted">Shown once. They can change it under their account menu.</p>
            </>
          )}
          {state.emailed && <p className="mt-1 text-xs text-muted">Not arrived in a few minutes? Ask them to check their spam folder.</p>}
        </div>
      )}
      {state.error && (
        <div className="text-sm text-red-700 sm:col-span-4">
          <p>{state.error}</p>
          {state.password && (
            <p className="mt-1 text-forest-900">
              Their temporary password: <span className="font-mono text-base font-semibold">{state.password}</span>
            </p>
          )}
        </div>
      )}
    </form>
  );
}
