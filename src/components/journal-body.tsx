"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { journalExtensions } from "./journal-tiptap";
import type { DocNode } from "@/lib/journal-doc";

/** A journal entry drawn read-only, with the same look as the editor. */
export function JournalBody({ doc }: { doc: DocNode }) {
  const editor = useEditor({
    extensions: journalExtensions,
    content: doc,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "journal-prose" } },
  });
  if (!editor) return <div className="min-h-24" aria-busy="true" />;
  return <EditorContent editor={editor} />;
}
