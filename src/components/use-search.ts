"use client";

import { useEffect, useState } from "react";

type SearchState<T> = { query: string; results: T[]; error: string | null };

/** Debounced search against one of the app's /api endpoints. */
export function useSearch<T>(endpoint: string, query: string, delayMs = 350) {
  const q = query.trim();
  const active = q.length >= 2;
  const [state, setState] = useState<SearchState<T>>({ query: "", results: [], error: null });

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Search failed.");
        setState({ query: q, results: body.results, error: null });
      } catch (e) {
        if (!controller.signal.aborted)
          setState({ query: q, results: [], error: e instanceof Error ? e.message : "Search failed." });
      }
    }, delayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, q, active, delayMs]);

  const current = active && state.query === q;
  return {
    results: current ? state.results : [],
    error: current ? state.error : null,
    loading: active && !current,
  };
}
