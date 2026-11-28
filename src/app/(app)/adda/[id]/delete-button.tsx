"use client";

/** Delete with a confirm. `owner` is set when the admin deletes someone else's creation. */
export function DeleteCreationButton({ id, action, owner }: { id: string; action: (fd: FormData) => Promise<void>; owner: string | null }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const msg = owner ? `Delete ${owner}'s creation? This can't be undone.` : "Delete this creation? This can't be undone.";
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-red-700 hover:underline">
        Delete
      </button>
    </form>
  );
}
