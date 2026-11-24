"use client";

import { deleteEntry } from "../actions";

/** `owner` is set when the admin deletes someone else's entry, so the warning names them. */
export function DeleteEntryButton({ id, owner = null }: { id: string; owner?: string | null }) {
  return (
    <form
      action={deleteEntry}
      onSubmit={(e) => {
        const message = owner
          ? `Delete ${owner}'s journal entry? This can't be undone.`
          : "Delete this journal entry? This can't be undone. Its photos stay in your media library.";
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-muted hover:text-red-700 hover:underline">
        Delete
      </button>
    </form>
  );
}
