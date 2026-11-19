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
        <Label htmlFor="invite-name">Name (optional)</Label>
        <Input id="invite-name" name="name" placeholder="Ravi" />
      </div>
      <div>
        <Label htmlFor="invite-role">Role</Label>
        <select id="invite-role" name="role" className="h-10 rounded-lg border border-line bg-paper px-3 text-sm">
          <option value="researcher">Researcher</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add to team"}
      </Button>
      {state.ok && <p className="text-sm text-forest-700 sm:col-span-4">{state.ok}</p>}
      {state.error && <p className="text-sm text-red-700 sm:col-span-4">{state.error}</p>}
    </form>
  );
}
