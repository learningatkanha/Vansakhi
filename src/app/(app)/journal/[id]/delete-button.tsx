"use client";

import { deleteEntry } from "../actions";

export function DeleteEntryButton({ id }: { id: string }) {
  return (
    <form
      action={deleteEntry}
      onSubmit={(e) => {
        if (!confirm("Delete this journal entry? This can't be undone. Its photos stay in your media library.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-muted hover:text-red-700 hover:underline">
        Delete
      </button>
    </form>
  );
}
