"use client";

import { useActionState } from "react";
import { sendSignInLink, type SignInState } from "./actions";
import { Button, Input, Label } from "@/components/ui";

export function LoginForm({ linkError = false }: { linkError?: boolean }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(sendSignInLink, { sent: false });

  if (state.sent) {
    return (
      <div className="text-center">
        <p className="font-medium">Check your email</p>
        <p className="mt-2 text-sm text-muted">
          If this address belongs to a team member, a sign-in link is on its way. It works once and expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {linkError && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          That link has expired or was already used. Ask for a new one below.
        </p>
      )}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
