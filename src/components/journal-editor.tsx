"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { journalExtensions } from "./journal-tiptap";
import { kindOf, uploadFile, videoWarning } from "@/lib/upload-client";
import { addEntryMedia } from "@/app/(app)/journal/actions";
import type { DocNode } from "@/lib/journal-doc";

type Pending = { id: string; name: string; progress: number; error?: string };
type Warning = { id: string; name: string; text: string };

/** The distraction-free journal editor: rich text plus photos and videos dropped in where the cursor is. */
export function JournalEditor({
  initial,
  onChange,
  onBusyChange,
}: {
  initial: DocNode;
  onChange: (doc: DocNode) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = useRef(0);
  // The drop and paste handlers below are created once, so they reach the editor and callbacks through refs.
  const editorRef = useRef<Editor | null>(null);
  const busyCallback = useRef(onBusyChange);
  useEffect(() => {
    busyCallback.current = onBusyChange;
  }, [onBusyChange]);

  const editor = useEditor({
    extensions: [...journalExtensions, Placeholder.configure({ placeholder: "What happened in the forest today?" })],
    content: initial,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "journal-prose min-h-[22rem] px-1 py-2 outline-none", "aria-label": "Journal entry" },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => kindOf(f));
        if (!files.length) return false;
        event.preventDefault();
        void addFiles(files);
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => kindOf(f));
        if (!files.length) return false;
        void addFiles(files);
        return true;
      },
    },
    onCreate: ({ editor }) => {
      editorRef.current = editor;
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as DocNode),
  });

  function setBusy(delta: number) {
    busy.current += delta;
    busyCallback.current?.(busy.current > 0);
  }

  async function addFiles(files: File[]) {
    for (const file of files) {
      const id = crypto.randomUUID();
      void videoWarning(file).then((text) => text && setWarnings((w) => [...w, { id, name: file.name, text }]));
      setPending((p) => [...p, { id, name: file.name, progress: 0 }]);
      setBusy(1);
      try {
        const up = await uploadFile(file, (progress) => setPending((p) => p.map((x) => (x.id === id ? { ...x, progress } : x))));
        const saved = await addEntryMedia(up);
        if ("error" in saved) throw new Error(saved.error);
        editorRef.current?.chain().focus().insertContent({ type: "media", attrs: { mediaId: saved.id, kind: up.kind, src: saved.url } }).run();
        setPending((p) => p.filter((x) => x.id !== id));
      } catch (e) {
        const error = e instanceof Error ? e.message : "Upload failed.";
        setPending((p) => p.map((x) => (x.id === id ? { ...x, error } : x)));
      } finally {
        setBusy(-1);
      }
    }
  }

  return (
    <div>
      <Toolbar editor={editor} onAddMedia={() => fileRef.current?.click()} />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void addFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      {warnings.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {warnings.map((w) => (
            <li key={w.id} className="rounded-lg border border-amber-500 bg-amber-50 p-2 text-xs text-amber-900">
              <span className="font-medium">⚠ {w.name}:</span> {w.text} You can delete it from the entry and add the new one.{" "}
              <button type="button" className="underline" onClick={() => setWarnings((x) => x.filter((y) => y.id !== w.id))}>
                OK
              </button>
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {pending.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              {p.error ? (
                <>
                  <span className="text-red-700">
                    {p.name}: {p.error}
                  </span>
                  <button type="button" className="text-muted hover:underline" onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))}>
                    Dismiss
                  </button>
                </>
              ) : (
                <span className="text-muted">
                  Uploading {p.name}… {p.progress}%
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <EditorContent editor={editor} className="mt-3" />
    </div>
  );
}

function Toolbar({ editor, onAddMedia }: { editor: Editor | null; onAddMedia: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
          }
        : null,
  });
  if (!editor || !state) return <div className="h-10 border-b border-line" />;

  const chain = () => editor.chain().focus();
  function setLink() {
    const current = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (leave empty to remove)", current ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url.trim() === "https://") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  const buttons: { label: string; title: string; active: boolean; run: () => void; className?: string }[] = [
    { label: "B", title: "Bold (Ctrl+B)", active: state.bold, run: () => chain().toggleBold().run(), className: "font-bold" },
    { label: "I", title: "Italic (Ctrl+I)", active: state.italic, run: () => chain().toggleItalic().run(), className: "italic" },
    { label: "H2", title: "Heading", active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
    { label: "H3", title: "Small heading", active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    { label: "• List", title: "Bulleted list", active: state.bullet, run: () => chain().toggleBulletList().run() },
    { label: "1. List", title: "Numbered list", active: state.ordered, run: () => chain().toggleOrderedList().run() },
    { label: "❝", title: "Quote", active: state.quote, run: () => chain().toggleBlockquote().run() },
    { label: "Link", title: "Add or remove a link", active: state.link, run: setLink },
  ];

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-line bg-paper py-2">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          title={b.title}
          aria-pressed={b.active}
          onMouseDown={(e) => e.preventDefault()}
          onClick={b.run}
          className={`h-8 min-w-8 rounded-md px-2 text-sm ${b.active ? "bg-forest-50 text-forest-800" : "text-muted hover:bg-wash hover:text-ink"} ${b.className ?? ""}`}
        >
          {b.label}
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-line" />
      <button
        type="button"
        onClick={onAddMedia}
        className="h-8 rounded-md px-2 text-sm font-medium text-forest-700 hover:bg-forest-50"
        title="Add photos or videos where the cursor is"
      >
        + Photo / video
      </button>
    </div>
  );
}
