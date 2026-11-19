"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "./actions";
import { Button, Input, Label } from "@/components/ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePassword, {});
  if (state.ok) return <p className="text-sm text-forest-700">Password changed. Use it next time you sign in.</p>;
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>
      </div>
      <div>
        <Label htmlFor="confirm">Type it again</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
