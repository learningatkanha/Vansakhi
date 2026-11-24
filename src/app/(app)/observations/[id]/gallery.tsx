"use client";

import { useEffect, useRef, useState } from "react";

type Item = { file_key: string; media_type: string; url: string | null };

export function Gallery({ items, title }: { items: Item[]; title: string }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const moved = useRef(false);
  const count = items.length;
  const current = items[index];

  // Go round in a circle: after the last comes the first, before the first comes the last.
  function step(dir: 1 | -1) {
    moved.current = true;
    setIndex((i) => (i + dir + count) % count);
  }

  // ← and → keys on a computer (not while typing in a box).
  useEffect(() => {
    if (count < 2) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // Keep the highlighted thumbnail in view when the arrows move past the visible ones.
  useEffect(() => {
    if (!moved.current) return;
    thumbs.current[index]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [index]);

  if (!current) {
    return <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-line bg-paper text-sm text-muted">No photo</div>;
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || count < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // A clear sideways swipe: swipe left = next, swipe right = previous.
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  }

  const arrow =
    "absolute top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-2xl leading-none text-white shadow transition hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-black" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {current.media_type === "video" ? (
          <video key={current.file_key} src={current.url ?? undefined} controls className="aspect-[4/3] w-full object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={current.file_key} src={current.url ?? undefined} alt={title} className="aspect-[4/3] w-full object-contain" />
        )}
        {count > 1 && (
          <>
            <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className={`${arrow} left-2`}>
              ‹
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next photo" className={`${arrow} right-2`}>
              ›
            </button>
            <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              {index + 1} of {count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {items.map((m, i) => (
            <button
              key={m.file_key}
              ref={(el) => {
                thumbs.current[i] = el;
              }}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show item ${i + 1}`}
              className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? "border-forest-600" : "border-transparent"}`}
            >
              {m.media_type === "video" ? (
                <>
                  <video src={`${m.url}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center text-white">▶</span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url ?? undefined} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
