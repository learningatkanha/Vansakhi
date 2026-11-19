"use client";

import { useActionState } from "react";
import { resetPassword, type ResetState } from "./actions";

export function ResetPasswordButton({ id, email }: { id: string; email: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {});
  if (state.password) {
    return (
      <span className="text-sm">
        New password: <span className="font-mono font-semibold">{state.password}</span>
      </span>
    );
  }
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Give ${email} a new temporary password? Their current password stops working.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-sm text-muted hover:text-ink hover:underline">
        {pending ? "Resetting…" : "Reset password"}
      </button>
      {state.error && <span className="ml-2 text-sm text-red-700">{state.error}</span>}
    </form>
  );
}
