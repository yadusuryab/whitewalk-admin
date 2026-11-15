/* eslint-disable @next/next/no-img-element */
// app/admin/reviews/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BadgeCheck, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, isPending, undoable, useDebounced, useList } from "@/lib/admin-data";
import {
  Actions, Btn, Empty, PER_PAGE, PageHead, Pager, Pill, Row,
  SearchInput, Select, Skeleton, Thumb,
} from "@/components/admin/ui";

// Add modal (and image compressor) loads only when opened.
const ReviewAdd = dynamic(() => import("./review-add"), { ssr: false });

interface Review {
  _id: string;
  customerName?: string;
  rating?: number;
  reviewText?: string;
  img?: string | null; // base CDN URL of the first image; size params added below
  imgCount: number;
  shoeName?: string;
  isVerifiedPurchase?: boolean;
  isApproved: boolean;
  createdAt: string;
}
type Res = { all: number; total: number; items: Review[] };

type Status = "all" | "approved" | "pending";
const STATUS: [Status, string][] = [
  ["all", "All status"],
  ["approved", "Approved only"],
  ["pending", "Pending only"],
];

const thumb = (u: string) => `${u}?w=112&h=112&fit=crop&q=60&auto=format`;
const write = (id: string, method: "PUT" | "DELETE", body?: object) =>
  api(`/api/reviews/${id}`, { method, body });

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-xl duration-200 animate-in fade-in"
    >
      <img
        src={`${src}?w=1000&auto=format`}
        alt=""
        className="max-h-full w-full max-w-sm rounded-3xl object-contain"
      />
    </div>
  );
}

export default function ReviewsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const q = useDebounced(search).trim();

  const qs = new URLSearchParams({ page: String(page), per: String(perPage), q, status }).toString();
  const { data, error, loading, mutate, refetch } = useList<Res>("/api/reviews/list", qs);

  const rows = (data?.items ?? []).filter((r) => !isPending(r._id));
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const filtering = !!search || status !== "all";

  const reset = <T,>(set: (v: T) => void) => (v: T) => (set(v), setPage(1));

  useEffect(() => {
    if (data && page > pages) setPage(pages);
  }, [data, page, pages]);

  const patch = (id: string, p: Partial<Review>) =>
    mutate((d) => ({ ...d, items: d.items.map((r) => (r._id === id ? { ...r, ...p } : r)) }));

  // Optimistic. Rolls back on failure.
  const toggle = async (r: Review) => {
    const next = !r.isApproved;
    patch(r._id, { isApproved: next });
    try {
      await write(r._id, "PUT", { isApproved: next });
    } catch {
      patch(r._id, { isApproved: !next });
      toast.error("Couldn't update review");
    }
  };

  const remove = (r: Review) =>
    undoable(
      r._id,
      "Review deleted",
      () => mutate((d) => ({ ...d, all: d.all - 1, total: d.total - 1, items: d.items.filter((x) => x._id !== r._id) })),
      () =>
        mutate((d) => ({
          ...d,
          all: d.all + 1,
          total: d.total + 1,
          items: [...d.items, r].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        })),
      async () => {
        await write(r._id, "DELETE");
        refetch(); // refill the page
      },
    );

  const goto = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <PageHead count={data && `${data.all} reviews`} title="Reviews.">
        <Btn variant="primary" className="h-12" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">Add review</span>
        </Btn>
      </PageHead>

      <div className="mt-8 flex flex-col gap-3">
        <SearchInput
          value={search}
          onChange={reset(setSearch)}
          placeholder="Search name, product or text…  ( / )"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-neutral-500">
            {rows.length} of {total}
          </p>
          <div className="flex gap-2">
            <Select label="Status" value={status} onChange={reset(setStatus)} options={STATUS} />
            <Select label="Per page" value={perPage} onChange={reset(setPerPage)} options={PER_PAGE} />
          </div>
        </div>
      </div>

      <div className={`mt-6 space-y-2 transition-opacity ${loading && data ? "opacity-50" : ""}`}>
        {!data && !error && <Skeleton />}
        {!data && error && <Empty text="Couldn't load reviews." action="Retry" onAction={refetch} />}

        {rows.map((r) => (
          <Row key={r._id} dim={!r.isApproved}>
            <button
              type="button"
              disabled={!r.img}
              onClick={() => r.img && setView(r.img)}
              className="relative shrink-0 transition-transform active:scale-95"
              aria-label="View image"
            >
              <Thumb src={r.img && thumb(r.img)} />
              {r.imgCount > 1 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-neutral-950 px-1.5 text-[10px] font-extrabold text-white">
                  {r.imgCount}
                </span>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-extrabold tracking-tight">{r.customerName || "Anonymous"}</span>
                {r.isVerifiedPurchase && <BadgeCheck className="h-4 w-4 shrink-0 text-blue-600" />}
                {!!r.rating && (
                  <span className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < r.rating! ? "fill-yellow-400 text-yellow-400" : "text-neutral-300"
                        }`}
                      />
                    ))}
                  </span>
                )}
              </div>
              {r.shoeName && <p className="text-xs font-semibold text-neutral-400">{r.shoeName}</p>}
              {r.reviewText && <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{r.reviewText}</p>}
            </div>

            <Actions>
              <Pill on={r.isApproved} onLabel="Approved" offLabel="Pending" onClick={() => toggle(r)} />
              <Btn icon variant="danger" title="Delete" onClick={() => remove(r)}>
                <Trash2 className="h-4 w-4" />
              </Btn>
            </Actions>
          </Row>
        ))}

        {data && !rows.length && (
          <Empty
            text={filtering ? "No reviews found." : "No review images yet."}
            action={filtering ? "Clear filters" : "Add review"}
            onAction={
              filtering
                ? () => {
                    setSearch("");
                    setStatus("all");
                    setPage(1);
                  }
                : () => setAdding(true)
            }
          />
        )}
      </div>

      <Pager page={page} pages={pages} onPage={goto} />

      {adding && <ReviewAdd onClose={() => setAdding(false)} onAdded={refetch} />}
      {view && <Lightbox src={view} onClose={() => setView(null)} />}
    </>
  );
}