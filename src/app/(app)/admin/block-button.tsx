"use client";

import { useActionState } from "react";
import { setBlocked, type BlockState } from "./actions";

export function BlockButton({ id, email, blocked }: { id: string; email: string; blocked: boolean }) {
  const [state, action, pending] = useActionState<BlockState, FormData>(setBlocked, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const message = blocked
          ? `Unblock ${email}? They can sign in and use the journal again.`
          : `Block ${email}? They won't be able to sign in or see anything. Their sightings and entries stay, and you can delete any of them.`;
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="block" value={blocked ? "0" : "1"} />
      <button
        type="submit"
        disabled={pending}
        className={`text-sm hover:underline ${blocked ? "text-forest-700" : "text-red-700"}`}
      >
        {pending ? "Saving…" : blocked ? "Unblock" : "Block"}
      </button>
      {state.error && <span className="ml-2 text-sm text-red-700">{state.error}</span>}
    </form>
  );
}
