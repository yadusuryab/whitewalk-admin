// app/admin/page.tsx
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { client } from "@/lib/sanity";
import { undoable, useDebounced, usePaged, useQuery } from "@/lib/admin-data";
import {
  BLUE_TAG,
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
  Tag,
  Thumb,
} from "@/components/admin/ui";
import { LABELS, OFFERS, QUERY, type Shoe } from "@/components/admin/products/shared";

// The edit modal (and the video compressor it imports) loads only when opened.
const ProductEdit = dynamic(() => import("@/components/admin/products/product-edit"), { ssr: false });

type Status = "all" | "active" | "off";
const STATUS: [Status, string][] = [
  ["all", "All status"],
  ["active", "Active only"],
  ["off", "Disabled only"],
];
const LABEL_OPTS: [string, any][] = [["all", "All labels"], ...LABELS];
const LABEL_TITLE: Record<string, string> = Object.fromEntries(LABELS);

export default function ProductsPage() {
  const { data, error, refetch, mutate } = useQuery<Shoe[]>("shoes", QUERY);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [label, setLabel] = useState("all");
  const [perPage, setPerPage] = useState(10);
  const [editId, setEditId] = useState<string | null>(null);
  const q = useDebounced(search).trim().toLowerCase();

  const filtered = useMemo(
    () =>
      (data ?? []).filter(
        (s) =>
          (status === "all" || (status === "off") === s.isDisabled) &&
          (label === "all" || s.productLabel?.includes(label)) &&
          (!q ||
            `${s.productName} ${s.orderNumber} ${s.price} ${s._id}`
              .toLowerCase()
              .includes(q)),
      ),
    [data, q, status, label],
  );
  const { rows, page, pages, setPage } = usePaged(
    filtered,
    perPage,
    `${q}|${status}|${label}|${perPage}`,
  );
  const editing = data?.find((s) => s._id === editId);
  const filtering = !!search || status !== "all" || label !== "all";

  const patch = (id: string, p: Partial<Shoe>) =>
    mutate((d) => d.map((s) => (s._id === id ? { ...s, ...p } : s)));

  // Optimistic. Rolls back if the write fails. No confirm dialog.
  const toggle = async (s: Shoe) => {
    const next = !s.isDisabled;
    patch(s._id, { isDisabled: next });
    try {
      await client.patch(s._id).set({ isDisabled: next }).commit();
    } catch {
      patch(s._id, { isDisabled: !next });
      toast.error("Couldn't update status");
    }
  };

  const remove = (s: Shoe) =>
    undoable(
      s._id,
      `Deleted “${s.productName}”`,
      () => mutate((d) => d.filter((x) => x._id !== s._id)),
      () =>
        mutate((d) => [...d, s].sort((a, b) => a.orderNumber - b.orderNumber)),
      () => client.delete(s._id),
    );

  return (
    <>
      <PageHead count={data && `${data.length} products`} title="Products.">
        <Link href="/admin/products/new">
          <Btn variant="primary" className="h-12">
            <Plus className="h-4 w-4" />
            <span className="hidden md:inline">Add shoe</span>
          </Btn>
        </Link>
      </PageHead>

      <div className="mt-6 flex flex-col gap-3 sm:mt-8">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, order number or price…"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-neutral-500">
            {filtered.length} of {data?.length ?? 0}
          </p>
          {/* Scrolls sideways on phones instead of wrapping into 3 lines. */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>select]:shrink-0">
            <Select label="Status" value={status} onChange={setStatus} options={STATUS} />
            <Select label="Label" value={label} onChange={setLabel} options={LABEL_OPTS} />
            <Select label="Per page" value={perPage} onChange={setPerPage} options={PER_PAGE} />
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2 sm:mt-6">
        {!data && !error && <Skeleton />}
        {!data && error && (
          <Empty text="Couldn't load products." action="Retry" onAction={refetch} />
        )}

        {rows.map((s) => (
          <Row key={s._id} dim={s.isDisabled} onClick={() => setEditId(s._id)}>
            <Thumb src={s.img} className="h-16 w-16 sm:h-14 sm:w-14" />

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-400">
                #{s.orderNumber}
              </p>
              <p className="truncate font-extrabold tracking-tight">{s.productName}</p>
              {/* Price sits under the name on phones, in its own column on desktop. */}
              <p className="text-lg font-extrabold leading-tight tracking-tight sm:hidden">
                ₹{s.price}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {s.productLabel?.map((l) => (
                  <Tag key={l}>{LABEL_TITLE[l] ?? l}</Tag>
                ))}
                {OFFERS.filter(([k]) => s[k] ?? k === "offer1Pair").map(([k, t]) => (
                  <Tag key={k} className={BLUE_TAG}>
                    {t}
                  </Tag>
                ))}
                {s.videoUrl && (
                  <Tag className={BLUE_TAG}>
                    <Video className="h-3 w-3" /> Video
                  </Tag>
                )}
                {!!s.disabledSizes?.length && (
                  <span className="text-[11px] font-semibold text-red-500">
                    Off: {s.disabledSizes.join(", ")}
                  </span>
                )}
              </div>
            </div>

            <p className="hidden text-xl font-extrabold tracking-tight sm:block">
              ₹{s.price}
            </p>

            {/* Full-width bottom bar on phones. Inline on desktop. */}
            <div
              className="flex w-full items-center justify-between gap-2 border-t border-neutral-200 pt-3 sm:ml-auto sm:w-auto sm:justify-end sm:border-0 sm:pt-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Pill
                on={!s.isDisabled}
                onLabel="Active"
                offLabel="Disabled"
                onClick={() => toggle(s)}
              />
              <div className="flex gap-2">
                <Btn icon title="Edit" onClick={() => setEditId(s._id)}>
                  <Pencil className="h-4 w-4" />
                </Btn>
                <Btn icon variant="danger" title="Delete" onClick={() => remove(s)}>
                  <Trash2 className="h-4 w-4" />
                </Btn>
              </div>
            </div>
          </Row>
        ))}

        {data && !rows.length && (
          <Empty
            text="No products found."
            onAction={
              filtering
                ? () => {
                    setSearch("");
                    setStatus("all");
                    setLabel("all");
                  }
                : undefined
            }
          />
        )}
      </div>

      <Pager page={page} pages={pages} onPage={setPage} />

      {editing && data && (
        <ProductEdit
          key={editing._id}
          shoe={editing}
          shoes={data}
          onClose={() => setEditId(null)}
          onSaved={(next) => {
            mutate(() => next);
            refetch(); // picks up the new image / video URLs
          }}
        />
      )}
    </>
  );
}