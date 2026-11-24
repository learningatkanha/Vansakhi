"use client";

import { useActionState, useState } from "react";
import { sendSignInLink, signInWithPassword, type PasswordState, type SignInState } from "./actions";
import { Button, Input, Label } from "@/components/ui";

export function LoginForm({ linkError = false, blocked = false }: { linkError?: boolean; blocked?: boolean }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  return (
    <div className="space-y-4">
      {blocked && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          This account no longer has access to the journal. Please speak to the admin.
        </p>
      )}
      {linkError && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          That link has expired or was already used. Sign in with your password, or ask for a new link.
        </p>
      )}
      {mode === "password" ? <PasswordForm /> : <LinkForm />}
      <button
        type="button"
        onClick={() => setMode(mode === "password" ? "link" : "password")}
        className="w-full text-center text-sm text-forest-700 hover:underline"
      >
        {mode === "password" ? "Forgot your password? Email me a sign-in link" : "Sign in with a password instead"}
      </button>
    </div>
  );
}

function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(signInWithPassword, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function LinkForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(sendSignInLink, { sent: false });
  if (state.sent) {
    return (
      <div className="text-center">
        <p className="font-medium">Check your email</p>
        <p className="mt-2 text-sm text-muted">
          If this address belongs to a team member, a sign-in link is on its way. Open it in this browser. Once
          you&apos;re in, set a new password under your account menu.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="link-email">Email</Label>
        <Input id="link-email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
