/* eslint-disable @next/next/no-img-element */
// app/admin/reviews/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { client } from "@/lib/sanity";
import { undoable, useDebounced, usePaged, useQuery } from "@/lib/admin-data";
import {
  Actions,
  Btn,
  Empty,
  PER_PAGE,
  PageHead,
  Pager,
  Pill,
  Row,
  SearchInput,
  Select,
  Skeleton,
  Thumb,
} from "@/components/admin/ui";

// Add modal (and image compressor) loads only when opened.
const ReviewAdd = dynamic(() => import("./review-add"), { ssr: false });

interface Review {
  _id: string;
  customerName?: string;
  rating?: number;
  reviewText?: string;
  images?: string[]; // CDN URLs, resolved in GROQ
  isVerifiedPurchase?: boolean;
  isApproved: boolean;
  createdAt: string;
  shoe?: { _id: string; productName: string };
}

type Status = "all" | "approved" | "pending";
const STATUS: [Status, string][] = [
  ["all", "All status"],
  ["approved", "Approved only"],
  ["pending", "Pending only"],
];

const QUERY = `*[_type == "review"] | order(createdAt desc) {
  _id, customerName, rating, reviewText, isVerifiedPurchase, isApproved, createdAt,
  "images": reviewImages[].asset->url,
  "shoe": shoe->{ _id, productName }
}`;

const thumb = (u: string) => `${u}?w=128&h=128&fit=crop&auto=format`;

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
  const { data, error, refetch, mutate } = useQuery<Review[]>("reviews", QUERY);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [perPage, setPerPage] = useState(10);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const q = useDebounced(search).trim().toLowerCase();

  const filtered = useMemo(
    () =>
      (data ?? []).filter(
        (r) =>
          (status === "all" || (status === "approved") === r.isApproved) &&
          (!q ||
            `${r.customerName} ${r.shoe?.productName} ${r.reviewText}`
              .toLowerCase()
              .includes(q)),
      ),
    [data, q, status],
  );
  const { rows, page, pages, setPage } = usePaged(
    filtered,
    perPage,
    `${q}|${status}|${perPage}`,
  );

  const patch = (id: string, p: Partial<Review>) =>
    mutate((d) => d.map((r) => (r._id === id ? { ...r, ...p } : r)));

  // Optimistic. Rolls back on failure.
  const toggle = async (r: Review) => {
    const next = !r.isApproved;
    patch(r._id, { isApproved: next });
    try {
      await client.patch(r._id).set({ isApproved: next }).commit();
    } catch {
      patch(r._id, { isApproved: !next });
      toast.error("Couldn't update review");
    }
  };

  const remove = (r: Review) =>
    undoable(
      r._id,
      "Review deleted",
      () => mutate((d) => d.filter((x) => x._id !== r._id)),
      () =>
        mutate((d) =>
          [...d, r].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        ),
      () => client.delete(r._id),
    );

  return (
    <>
      <PageHead count={data && `${data.length} reviews`} title="Reviews.">
        <Btn variant="primary" className="h-12" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">Add review</span>
        </Btn>
      </PageHead>

      <div className="mt-8 flex flex-col gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, product or text…  ( / )"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-neutral-500">
            {filtered.length} of {data?.length ?? 0}
          </p>
          <div className="flex gap-2">
            <Select label="Status" value={status} onChange={setStatus} options={STATUS} />
            <Select label="Per page" value={perPage} onChange={setPerPage} options={PER_PAGE} />
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {!data && !error && <Skeleton />}
        {!data && error && (
          <Empty text="Couldn't load reviews." action="Retry" onAction={refetch} />
        )}

        {rows.map((r) => {
          const first = r.images?.[0];
          return (
            <Row key={r._id} dim={!r.isApproved}>
              <button
                type="button"
                disabled={!first}
                onClick={() => first && setView(first)}
                className="relative shrink-0 transition-transform active:scale-95"
                aria-label="View image"
              >
                <Thumb src={first && thumb(first)} />
                {(r.images?.length ?? 0) > 1 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-neutral-950 px-1.5 text-[10px] font-extrabold text-white">
                    {r.images!.length}
                  </span>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-extrabold tracking-tight">
                    {r.customerName || "Anonymous"}
                  </span>
                  {r.isVerifiedPurchase && (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-blue-600" />
                  )}
                  {!!r.rating && (
                    <span className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < r.rating!
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-neutral-300"
                          }`}
                        />
                      ))}
                    </span>
                  )}
                </div>
                {r.shoe?.productName && (
                  <p className="text-xs font-semibold text-neutral-400">{r.shoe.productName}</p>
                )}
                {r.reviewText && (
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{r.reviewText}</p>
                )}
              </div>

              <Actions>
                <Pill
                  on={r.isApproved}
                  onLabel="Approved"
                  offLabel="Pending"
                  onClick={() => toggle(r)}
                />
                <Btn icon variant="danger" title="Delete" onClick={() => remove(r)}>
                  <Trash2 className="h-4 w-4" />
                </Btn>
              </Actions>
            </Row>
          );
        })}

        {data && !rows.length && (
          <Empty
            text={data.length ? "No reviews found." : "No review images yet."}
            action={data.length ? "Clear filters" : "Add review"}
            onAction={
              data.length
                ? search || status !== "all"
                  ? () => {
                      setSearch("");
                      setStatus("all");
                    }
                  : undefined
                : () => setAdding(true)
            }
          />
        )}
      </div>

      <Pager page={page} pages={pages} onPage={setPage} />

      {adding && <ReviewAdd onClose={() => setAdding(false)} onAdded={refetch} />}
      {view && <Lightbox src={view} onClose={() => setView(null)} />}
    </>
  );
}