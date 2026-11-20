"use client";

import { deleteObservation } from "./actions";

export function DeleteButton({ id }: { id: string }) {
  return (
    <form
      action={deleteObservation}
      onSubmit={(e) => {
        if (!confirm("Delete this observation? This can't be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-muted hover:text-red-700 hover:underline">
        Delete
      </button>
    </form>
  );
}
