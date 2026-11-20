"use client";

import { useState } from "react";

type Item = { file_key: string; media_type: string; url: string | null };

export function Gallery({ items, title }: { items: Item[]; title: string }) {
  const [index, setIndex] = useState(0);
  const current = items[index];

  if (!current) {
    return <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-line bg-paper text-sm text-muted">No photo</div>;
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-black">
        {current.media_type === "video" ? (
          <video key={current.file_key} src={current.url ?? undefined} controls className="aspect-[4/3] w-full object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url ?? undefined} alt={title} className="aspect-[4/3] w-full object-contain" />
        )}
        {items.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            {index + 1} of {items.length}
          </span>
        )}
      </div>
      {items.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {items.map((m, i) => (
            <button
              key={m.file_key}
              type="button"
              onClick={() => setIndex(i)}
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
