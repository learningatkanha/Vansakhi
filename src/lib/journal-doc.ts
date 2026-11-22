/**
 * Helpers for journal bodies, stored as Tiptap (ProseMirror) JSON.
 * Pure functions, safe on server and client, and covered by tests/journal.test.ts.
 *
 * Embedded photos and videos are "media" nodes holding a media id. The signed link that shows the file
 * expires, so it is never stored: the server adds fresh links when an entry is opened (withMediaUrls)
 * and removes them again before saving (cleanDoc).
 */

export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

export const EMPTY_DOC: DocNode = { type: "doc", content: [{ type: "paragraph" }] };

const ALLOWED_NODES = new Set([
  "doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem",
  "blockquote", "hardBreak", "horizontalRule", "media",
]);
const ALLOWED_MARKS = new Set(["bold", "italic", "underline", "strike", "link"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeHref(href: unknown) {
  if (typeof href !== "string") return null;
  const h = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(h) ? h.slice(0, 2000) : null;
}

/**
 * Keeps only the node and mark types the editor makes, drops unsafe links and media links,
 * so an entry shared with the team can't carry anything harmful. Returns null for something that isn't a doc.
 */
export function cleanDoc(input: unknown): DocNode | null {
  if (!input || typeof input !== "object" || (input as DocNode).type !== "doc") return null;

  function walk(node: DocNode): DocNode | null {
    if (!node || typeof node !== "object" || !ALLOWED_NODES.has(node.type)) return null;
    const out: DocNode = { type: node.type };

    if (node.type === "text") {
      if (typeof node.text !== "string" || node.text === "") return null;
      out.text = node.text;
      const marks = (Array.isArray(node.marks) ? node.marks : []).flatMap((m) => {
        if (!m || !ALLOWED_MARKS.has(m.type)) return [];
        if (m.type !== "link") return [{ type: m.type }];
        const href = safeHref(m.attrs?.href);
        return href ? [{ type: "link", attrs: { href } }] : [];
      });
      if (marks.length) out.marks = marks;
      return out;
    }

    if (node.type === "heading") {
      const level = Number(node.attrs?.level);
      out.attrs = { level: level === 3 ? 3 : 2 };
    }
    if (node.type === "orderedList" && Number(node.attrs?.start) > 1) {
      out.attrs = { start: Math.floor(Number(node.attrs!.start)) };
    }
    if (node.type === "media") {
      const mediaId = node.attrs?.mediaId;
      if (typeof mediaId !== "string" || !UUID.test(mediaId)) return null;
      return { type: "media", attrs: { mediaId, kind: node.attrs?.kind === "video" ? "video" : "photo" } };
    }

    if (Array.isArray(node.content)) {
      const kids = node.content.map(walk).filter((n): n is DocNode => n !== null);
      if (kids.length) out.content = kids;
    }
    return out;
  }

  return walk(input as DocNode) ?? EMPTY_DOC;
}

/** Ids of the photos and videos embedded in a doc, in order, without repeats. */
export function mediaIdsIn(doc: DocNode): string[] {
  const ids: string[] = [];
  (function walk(n: DocNode) {
    if (n.type === "media" && typeof n.attrs?.mediaId === "string" && !ids.includes(n.attrs.mediaId)) ids.push(n.attrs.mediaId);
    n.content?.forEach(walk);
  })(doc);
  return ids;
}

/** Adds a view link to each media node. Media the reader may not see (no link in `urls`) is left out. */
export function withMediaUrls(doc: DocNode, urls: Map<string, string>): DocNode {
  function walk(n: DocNode): DocNode | null {
    if (n.type === "media") {
      const src = urls.get(String(n.attrs?.mediaId));
      return src ? { ...n, attrs: { ...n.attrs, src } } : null;
    }
    return n.content ? { ...n, content: n.content.map(walk).filter((c): c is DocNode => c !== null) } : n;
  }
  return walk(doc) ?? EMPTY_DOC;
}

/** The words of a doc as plain text, one block per line: used for search and list previews. */
export function docText(doc: DocNode): string {
  const blocks: string[] = [];
  (function walk(n: DocNode, line: string[] | null) {
    if (n.type === "text") return void line?.push(n.text ?? "");
    if (n.type === "hardBreak") return void line?.push(" ");
    if (n.type === "paragraph" || n.type === "heading") {
      const own: string[] = [];
      n.content?.forEach((c) => walk(c, own));
      const text = own.join("").trim();
      if (text) blocks.push(text);
      return;
    }
    n.content?.forEach((c) => walk(c, line));
  })(doc, null);
  return blocks.join("\n");
}

/** "birds, Tiger , nest" → ["birds", "tiger", "nest"]: lower case, no repeats, at most 20. */
export function parseTags(input: string): string[] {
  const tags = input
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/^#/, "").slice(0, 40))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 20);
}

/** Start and end of a calendar day in India time, as ISO strings, for "sightings made that day". */
export function istDayRange(date: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const from = new Date(`${date}T00:00:00+05:30`);
  if (isNaN(+from)) return null;
  return { from: from.toISOString(), to: new Date(+from + 86_400_000).toISOString() };
}

/** The India-time date of a moment, "2026-11-20". */
export function istDateOf(iso: string): string | null {
  const d = new Date(iso);
  return isNaN(+d) ? null : d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Today's date in India time, "2026-11-20". */
export function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Cleans a word typed into the journal search so it is safe inside a database filter. */
export function searchTerm(q: string) {
  return q.replace(/[,()*%\\:"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}
