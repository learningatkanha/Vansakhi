"use client";

import { useActionState } from "react";
import { removeMember, type RemoveState } from "./actions";

export function RemoveButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState<RemoveState, FormData>(removeMember, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const message =
          `Remove ${label} from the team?\n\n` +
          "Their login will be deleted permanently: they can never sign in again. " +
          "Their sightings, photos and journal entries stay, marked as a former member's, and you can still delete any of them.\n\n" +
          "This can't be undone. (Block instead if they might come back.)";
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-sm text-red-700 hover:underline">
        {pending ? "Removing…" : "Remove"}
      </button>
      {state.error && <span className="ml-2 text-sm text-red-700">{state.error}</span>}
    </form>
  );
}
