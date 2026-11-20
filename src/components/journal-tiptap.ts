import { Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

/**
 * A photo or video inside a journal entry. Saved as { mediaId, kind }; `src` is a short-lived view link
 * the server adds when the entry is opened, and is dropped again on save.
 */
export const MediaNode = Node.create({
  name: "media",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      mediaId: { default: null, rendered: false },
      kind: { default: "photo", rendered: false },
      src: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [];
  },

  renderHTML({ node }) {
    const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
    if (node.attrs.kind === "video") {
      return ["figure", { class: "journal-media" }, ["video", { src, controls: "true", preload: "metadata", playsinline: "true" }]];
    }
    return ["figure", { class: "journal-media" }, ["img", { src, alt: "", loading: "lazy" }]];
  },
});

/** The editor's building blocks, shared by the editor and the read-only view so both draw an entry the same way. */
export const journalExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["http", "https", "mailto"],
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
    },
  }),
  MediaNode,
];
