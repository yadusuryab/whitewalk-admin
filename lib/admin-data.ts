"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { client } from "@/lib/sanity";

// Module-level cache. Revisiting a page paints instantly, then revalidates.
const cache = new Map<string, unknown>();
// Ids deleted but still inside the undo window. Refetches must not resurrect them.
const pendingDeletes = new Set<string>();

export function useQuery<T>(key: string, query: string) {
  const [data, setData] = useState<T | undefined>(() =>
    cache.has(key) ? (cache.get(key) as T) : undefined,
  );
  const [error, setError] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const raw = await client.fetch<T>(query, {}, { cache: "no-store" });
      const next = Array.isArray(raw)
        ? (raw.filter((x: any) => !pendingDeletes.has(x?._id)) as T)
        : raw;
      cache.set(key, next);
      setData(next);
      setError(false);
    } catch (e) {
      console.error(e);
      setError(true);
    }
  }, [key, query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const mutate = useCallback(
    (fn: (d: T) => T) =>
      setData((prev) => {
        if (prev === undefined) return prev;
        const next = fn(prev);
        cache.set(key, next);
        return next;
      }),
    [key],
  );

  return { data, error, refetch, mutate };
}

export function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function usePaged<T>(items: T[], perPage: number, resetKey: string) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const cur = Math.min(page, pages);
  return {
    rows: items.slice((cur - 1) * perPage, cur * perPage),
    page: cur,
    pages,
    setPage: (p: number) => {
      setPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  };
}

/**
 * Delete without a confirm dialog.
 * UI updates at once. The real delete runs after 5s unless the user hits Undo.
 */
export function undoable(
  id: string,
  label: string,
  apply: () => void,
  undo: () => void,
  commit: () => Promise<unknown>,
) {
  pendingDeletes.add(id);
  apply();
  const timer = setTimeout(async () => {
    try {
      await commit();
    } catch (e) {
      console.error(e);
      pendingDeletes.delete(id);
      undo();
      toast.error("Couldn't delete. Restored.");
      return;
    }
    pendingDeletes.delete(id);
  }, 5000);

  toast(label, {
    duration: 5000,
    action: {
      label: "Undo",
      onClick: () => {
        clearTimeout(timer);
        pendingDeletes.delete(id);
        undo();
      },
    },
  });
}