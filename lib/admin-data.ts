"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/** Fetch wrapper: JSON or FormData body, throws Error(message) on failure. */
export async function api<T = any>(
  url: string,
  init: Omit<RequestInit, "body"> & { body?: any } = {},
): Promise<T> {
  const { body, headers, ...rest } = init;
  const raw = body instanceof FormData || typeof body === "string" || body == null;
  const res = await fetch(url, {
    ...rest,
    body: raw ? body : JSON.stringify(body),
    headers: raw ? headers : { "Content-Type": "application/json", ...headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** In-memory page cache shared by all admin lists. Cleared after any write. */
export const listCache = new Map<string, any>();

/**
 * One server page, cached in memory.
 * mutate() edits the visible page and drops every other cached page.
 * refetch() drops the cache and reloads.
 */
export function useList<T>(url: string, qs: string) {
  const key = `${url}?${qs}`;
  const [state, setState] = useState<{ key?: string; data?: T; error?: boolean }>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const hit = listCache.get(key);
    if (hit) return setState({ key, data: hit });
    const ac = new AbortController();
    api<T>(key, { signal: ac.signal })
      .then((data) => {
        listCache.set(key, data);
        setState({ key, data });
      })
      .catch((e) => e?.name !== "AbortError" && setState((s) => ({ ...s, error: true })));
    return () => ac.abort();
  }, [key, tick]);

  const mutate = useCallback(
    (fn: (d: T) => T) =>
      setState((s) => {
        if (!s.data) return s;
        const data = fn(s.data);
        listCache.clear();
        if (s.key) listCache.set(s.key, data);
        return { ...s, data };
      }),
    [],
  );

  const refetch = useCallback(() => {
    listCache.clear();
    setState((s) => ({ ...s, error: false }));
    setTick((t) => t + 1);
  }, []);

  return { ...state, loading: state.key !== key && !state.error, mutate, refetch };
}

// Ids deleted but still inside the undo window.
const pending = new Set<string>();
export const isPending = (id: string) => pending.has(id);

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Delete without a confirm dialog: runs after 5s unless the user hits Undo. */
export function undoable(
  id: string,
  label: string,
  apply: () => void,
  undo: () => void,
  commit: () => Promise<unknown>,
) {
  pending.add(id);
  apply();
  const timer = setTimeout(async () => {
    try {
      await commit();
    } catch (e) {
      console.error(e);
      pending.delete(id);
      undo();
      toast.error("Couldn't delete. Restored.");
      return;
    }
    pending.delete(id);
  }, 5000);

  toast(label, {
    duration: 5000,
    action: {
      label: "Undo",
      onClick: () => {
        clearTimeout(timer);
        pending.delete(id);
        undo();
      },
    },
  });
}