"use client";

import { useActionState } from "react";
import { saveName, type NameState } from "@/app/actions";
import { Button, Input, Label } from "@/components/ui";

export function NameForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<NameState, FormData>(saveName, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" defaultValue={initial} required minLength={2} maxLength={60} placeholder="How the team will see you" />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
