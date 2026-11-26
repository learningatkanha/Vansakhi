import { test } from "node:test";
import assert from "node:assert/strict";
import { statusAfterNaming } from "../src/lib/id-status.ts";
import { hasHevcMarker } from "../src/lib/video-check.ts";
import { byNearness, cleanDoc, docText, istDateOf, istDayRange, mediaIdsIn, parseTags, searchTerm, withMediaUrls } from "../src/lib/journal-doc.ts";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

test("cleanDoc keeps the editor's content and drops anything else", () => {
  const doc = cleanDoc({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 7 }, content: [{ type: "text", text: "Morning drive" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Saw a ", marks: [{ type: "bold" }, { type: "evil" }] },
          { type: "text", text: "tiger", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
          { type: "text", text: " near ", marks: [{ type: "link", attrs: { href: "https://maps.google.com", onclick: "x" } }] },
        ],
      },
      { type: "script", content: [{ type: "text", text: "bad" }] },
      { type: "media", attrs: { mediaId: ID1, kind: "video", src: "https://signed.example/expiring", extra: 1 } },
      { type: "media", attrs: { mediaId: "not-a-uuid" } },
    ],
  });
  assert.deepEqual(doc, {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Morning drive" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Saw a ", marks: [{ type: "bold" }] },
          { type: "text", text: "tiger" },
          { type: "text", text: " near ", marks: [{ type: "link", attrs: { href: "https://maps.google.com" } }] },
        ],
      },
      { type: "media", attrs: { mediaId: ID1, kind: "video" } },
    ],
  });
  assert.equal(cleanDoc({ type: "paragraph" }), null);
  assert.equal(cleanDoc("hello"), null);
});

test("media ids, view links and plain text", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Waterhole" }, { type: "hardBreak" }, { type: "text", text: "at dusk" }] },
      { type: "media", attrs: { mediaId: ID1, kind: "photo" } },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Sambar" }] }] }] },
      { type: "media", attrs: { mediaId: ID2, kind: "photo" } },
      { type: "media", attrs: { mediaId: ID1, kind: "photo" } },
    ],
  };
  assert.deepEqual(mediaIdsIn(doc), [ID1, ID2]);
  assert.equal(docText(doc), "Waterhole at dusk\nSambar");

  // Media the reader can't see is left out; the rest gets its link.
  const shown = withMediaUrls(doc, new Map([[ID1, "https://view/1"]]));
  assert.deepEqual(mediaIdsIn(shown), [ID1]);
  assert.equal(shown.content!.filter((n) => n.type === "media").length, 2);
  assert.equal(shown.content![1].attrs!.src, "https://view/1");
});

test("tags, search words and India-time days", () => {
  assert.deepEqual(parseTags(" Birds, #tiger ,, birds, Nest "), ["birds", "tiger", "nest"]);
  assert.equal(searchTerm("  tiger, (cub)*  "), "tiger cub");
  assert.deepEqual(istDayRange("2026-11-20"), { from: "2026-11-19T18:30:00.000Z", to: "2026-11-20T18:30:00.000Z" });
  assert.equal(istDayRange("20-11-2026"), null);
});

test("istDateOf gives the India date of a moment", () => {
  assert.equal(istDateOf("2026-11-20T20:00:00Z"), "2026-11-21"); // 1:30 am next day in India
  assert.equal(istDateOf("2026-11-20T10:00:00Z"), "2026-11-20");
  assert.equal(istDateOf("not a date"), null);
});

test("liveTitle shows a renamed sighting's latest name, but never a title the writer chose", async () => {
  const { liveTitle } = await import("../src/lib/journal-doc.ts");
  const ant = { current: "Orange Weaver Ant", past: ["Weaver Ant", "weaver ant"] };
  assert.equal(liveTitle("Weaver ant", [ant]), "Orange Weaver Ant");
  assert.equal(liveTitle("weaver ant?", [ant]), "Orange Weaver Ant");
  assert.equal(liveTitle("Unknown species", [ant]), "Orange Weaver Ant");
  assert.equal(liveTitle("red ants?", [ant]), "Orange Weaver Ant"); // an old guess, one sighting
  assert.equal(liveTitle("Orange Weaver Ant", [ant]), "Orange Weaver Ant");
  assert.equal(liveTitle("Story: The Weaver Ants", [ant]), "Story: The Weaver Ants");
  assert.equal(liveTitle("Morning drive", [ant]), "Morning drive");
  assert.equal(liveTitle("Weaver ant", []), "Weaver ant");
  assert.equal(liveTitle("", [ant]), "");
});

test("byNearness puts the entry's day first, then the closest days either side", () => {
  const day = istDayRange("2026-11-20")!;
  const at = (iso: string) => ({ observed_at: iso });
  const items = [
    at("2026-11-10T06:00:00+05:30"), // 10 days before
    at("2026-11-20T17:00:00+05:30"), // same day, evening
    at("2026-11-22T08:00:00+05:30"), // 2 days after
    at("2026-11-19T18:00:00+05:30"), // the evening before
    at("2026-11-20T06:30:00+05:30"), // same day, morning
    at("2026-11-21T00:10:00+05:30"), // just after midnight
  ];
  assert.deepEqual(
    byNearness(items, day).map((x) => x.observed_at),
    [
      "2026-11-20T06:30:00+05:30",
      "2026-11-20T17:00:00+05:30",
      "2026-11-21T00:10:00+05:30",
      "2026-11-19T18:00:00+05:30",
      "2026-11-22T08:00:00+05:30",
      "2026-11-10T06:00:00+05:30",
    ],
  );
});

test("hasHevcMarker spots HEVC video tracks and ignores H.264 ones", () => {
  const box = (type: string) => new Uint8Array([0, 0, 0, 0x6c, ...Array.from(type, (c) => c.charCodeAt(0)), 0, 0, 0, 0]);
  assert.equal(hasHevcMarker(box("hvc1")), true);
  assert.equal(hasHevcMarker(box("hev1")), true);
  assert.equal(hasHevcMarker(box("avc1")), false);
  assert.equal(hasHevcMarker(new Uint8Array([0x68, 0x76, 0x63])), false); // cut short: "hvc"
});

test("statusAfterNaming follows the four-state rules", () => {
  const base = { named: true, sure: true, reviewer: false, current: null, speciesChanged: true } as const;
  assert.equal(statusAfterNaming({ ...base, named: false }), "needs_id");
  assert.equal(statusAfterNaming({ ...base, sure: false }), "suggested");
  assert.equal(statusAfterNaming(base), "self_confirmed");
  assert.equal(statusAfterNaming({ ...base, reviewer: true }), "verified");
  // A verified sighting keeps its badge when only notes change...
  assert.equal(statusAfterNaming({ ...base, current: "verified", speciesChanged: false }), "verified");
  // ...but not when an observer changes the name, or says they're no longer sure.
  assert.equal(statusAfterNaming({ ...base, current: "verified", speciesChanged: true }), "self_confirmed");
  assert.equal(statusAfterNaming({ ...base, current: "verified", speciesChanged: false, sure: false }), "suggested");
});
